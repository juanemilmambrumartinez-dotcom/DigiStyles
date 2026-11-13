function Probar-BffAdmin {
    $ErrorActionPreference = 'Stop'
    $api = "http://localhost:5008"; $web = "http://localhost:3000"
    $srv = "localhost"; $db = "DigiStylesDev"
    $jarNormal = "C:\Temp\bffadm-normal.txt"; $jarAdmin = "C:\Temp\bffadm-admin.txt"
    $global:pasan = 0; $global:fallan = 0; $global:respuestas = @()

    function Chk($nombre, $ok, $detalle = "") {
        if ($ok) { $global:pasan++; "PASA   $nombre" } else { $global:fallan++; "FALLA  $nombre   $detalle" }
    }
    function Sql($q) { & sqlcmd -S $srv -E -d $db -h -1 -W -Q "SET NOCOUNT ON; $q" }
    function Llamar($base, $metodo, $ruta, $cuerpo = $null, $jar = $null, $guardar = $false, $origen = $null, $tipo = "application/json") {
        $a = @("-s", "-i", "-X", $metodo, "$base$ruta", "-H", "Expect:")
        if ($origen) { $a += @("-H", "Origin: $origen") }
        if ($jar) { if ($guardar) { $a += @("-c", $jar) } else { $a += @("-b", $jar) } }
        $tmp = $null
        if ($null -ne $cuerpo) {
            $tmp = Join-Path $env:TEMP ("ds-bffadm-" + [guid]::NewGuid().ToString("N") + ".txt")
            [System.IO.File]::WriteAllText($tmp, $cuerpo)
            $a += @("-H", "Content-Type: $tipo", "--data-binary", "@$tmp")
        }
        $salida = @(& curl.exe @a)
        if ($tmp) { Remove-Item $tmp -ErrorAction SilentlyContinue }
        $estado = [int](($salida[0] -split " ")[1])
        $todo = $salida -join "`n"
        $parsed = $null
        try { $parsed = ([string]$salida[-1]) | ConvertFrom-Json } catch { }
        $r = [pscustomobject]@{ Status = $estado; NoStore = [bool]($todo -match "(?im)^cache-control:.*no-store"); Body = [string]$salida[-1]; Json = $parsed; Base = $base }
        if ($base -eq $web) { $global:respuestas += $r }
        $r
    }
    function NuevoUsuario($prefijo) {
        $correo = "$prefijo$(Get-Random)@example.com"
        $cuerpo = @{ name = "Prueba $prefijo"; email = $correo; password = "ClavePrueba123" } | ConvertTo-Json -Compress
        $r = Llamar $api "POST" "/api/auth/register" $cuerpo
        if ($r.Status -ne 200 -and $r.Status -ne 201) { throw "El registro de $correo falló con el código $($r.Status)" }
        [pscustomobject]@{ Email = $correo }
    }
    function LoginWeb($correo, $jar) {
        $cuerpo = @{ email = $correo; password = "ClavePrueba123" } | ConvertTo-Json -Compress
        Llamar $web "POST" "/api/auth/login" $cuerpo $jar $true $web
    }
    function Rechazada($r) { ($r.Status -ge 400 -and $r.Status -lt 500 -and $r.Status -ne 404) }

    try {
        "Creando 2 usuarios de prueba (unos 15 segundos)..."
        $u1 = NuevoUsuario "bffadmnormal"
        Start-Sleep -Seconds 15
        $u2 = NuevoUsuario "bffadmadmin"
        Sql "INSERT INTO AspNetUserRoles (UserId, RoleId) SELECT u.Id, r.Id FROM AspNetUsers u CROSS JOIN AspNetRoles r WHERE u.Email = '$($u2.Email)' AND r.Name = 'admin'" | Out-Null
        $tieneRol = Sql "SELECT COUNT(*) FROM AspNetUserRoles ur JOIN AspNetUsers u ON u.Id = ur.UserId JOIN AspNetRoles r ON r.Id = ur.RoleId WHERE u.Email = '$($u2.Email)' AND r.Name = 'admin'" | Select-Object -First 1
        Chk "B00a el usuario admin tiene el rol admin en la base" ($tieneRol -eq "1")
        $l1 = LoginWeb $u1.Email $jarNormal
        $l2 = LoginWeb $u2.Email $jarAdmin
        Chk "B00b login por el intermediario (usuario normal y admin) -> 200" ($l1.Status -eq 200 -and $l2.Status -eq 200) "normal $($l1.Status), admin $($l2.Status)"

        $g = [guid]::NewGuid().ToString()
        $ok = '{"status":"Confirmado"}'

        ""
        "--- Sin sesión ---"
        $r = Llamar $web "GET" "/api/admin/orders"
        Chk "B01 lista sin cookie -> 401, no-store y sin tokens en el cuerpo" ($r.Status -eq 401 -and $r.NoStore -and $r.Body -notmatch "eyJ") "HTTP $($r.Status) $($r.Body)"
        $r = Llamar $web "GET" "/api/admin/orders/$g"
        Chk "B02 detalle sin cookie -> 401" ($r.Status -eq 401) "HTTP $($r.Status)"
        $r = Llamar $web "POST" "/api/admin/orders/$g/status" $ok $null $false $web
        Chk "B03 cambio de estado sin cookie -> 401" ($r.Status -eq 401) "HTTP $($r.Status)"

        ""
        "--- Entrada inválida (no llega a la API) ---"
        $r = Llamar $web "GET" "/api/admin/orders?status=Inventado"
        Chk "B04 filtro inventado -> 400 solicitud_invalida" ($r.Status -eq 400 -and $r.Json.code -eq "solicitud_invalida") "HTTP $($r.Status)"
        $r = Llamar $web "GET" "/api/admin/orders?status=pendiente"
        Chk "B05 filtro en minúscula -> 400" ($r.Status -eq 400) "HTTP $($r.Status)"
        $r = Llamar $web "GET" "/api/admin/orders?status=Pendiente%27%20OR%201%3D1"
        Chk "B06 filtro con intento de inyección -> 400" ($r.Status -eq 400) "HTTP $($r.Status)"
        $r = Llamar $web "GET" "/api/admin/orders/no-es-guid" $null $jarAdmin
        Chk "B07 detalle con id que no es guid -> 404" ($r.Status -eq 404) "HTTP $($r.Status)"
        $r = Llamar $web "POST" "/api/admin/orders/no-es-guid/status" $ok $jarAdmin $false $web
        Chk "B08 cambio de estado con id que no es guid -> 404" ($r.Status -eq 404) "HTTP $($r.Status)"
        $r1 = Llamar $web "DELETE" "/api/admin/orders"
        $r2 = Llamar $web "PUT" "/api/admin/orders/$g/status"
        Chk "B09 métodos no permitidos (DELETE y PUT) -> 405" ($r1.Status -eq 405 -and $r2.Status -eq 405) "DELETE $($r1.Status), PUT $($r2.Status)"

        ""
        "--- POST de estado: origen, tipo y cuerpo (admin, pedido inexistente) ---"
        $r = Llamar $web "POST" "/api/admin/orders/$g/status" $ok $jarAdmin $false "http://evil.example"
        Chk "B10 origen distinto -> rechazado (4xx, no llega a la API)" (Rechazada $r) "HTTP $($r.Status) $($r.Body)"
        $r = Llamar $web "POST" "/api/admin/orders/$g/status" $ok $jarAdmin $false $web "text/plain"
        Chk "B11 Content-Type distinto de JSON -> rechazado" (Rechazada $r) "HTTP $($r.Status) $($r.Body)"
        $r = Llamar $web "POST" "/api/admin/orders/$g/status" "esto no es json" $jarAdmin $false $web
        Chk "B12 cuerpo que no es JSON -> 400" ($r.Status -eq 400) "HTTP $($r.Status)"
        $r = Llamar $web "POST" "/api/admin/orders/$g/status" '["Confirmado"]' $jarAdmin $false $web
        Chk "B13 cuerpo que es un arreglo -> 400" ($r.Status -eq 400) "HTTP $($r.Status)"
        $r = Llamar $web "POST" "/api/admin/orders/$g/status" '{"status":"Confirmado","extra":1}' $jarAdmin $false $web
        Chk "B14 campo extra en el cuerpo -> 400" ($r.Status -eq 400) "HTTP $($r.Status)"
        $r = Llamar $web "POST" "/api/admin/orders/$g/status" '{"status":"Inventado"}' $jarAdmin $false $web
        Chk "B15 estado inventado -> 400" ($r.Status -eq 400) "HTTP $($r.Status)"
        $r = Llamar $web "POST" "/api/admin/orders/$g/status" '{"status":"confirmado"}' $jarAdmin $false $web
        Chk "B16 estado en minúscula -> 400" ($r.Status -eq 400) "HTTP $($r.Status)"
        $r = Llamar $web "POST" "/api/admin/orders/$g/status" ($ok + (" " * 1100)) $jarAdmin $false $web
        Chk "B17 cuerpo de más de 1 KB (JSON válido con espacios) -> 400, no llega a la API" ($r.Status -eq 400) "HTTP $($r.Status) $($r.Body)"
        $r = Llamar $web "POST" "/api/admin/orders/$g/status" ($ok + (" " * 400)) $jarAdmin $false $web
        Chk "B18 cuerpo de menos de 1 KB -> llega a la API: 404 pedido_no_encontrado" ($r.Status -eq 404 -and $r.Json.code -eq "pedido_no_encontrado") "HTTP $($r.Status) $($r.Body)"

        ""
        "--- Usuario sin rol admin ---"
        $r = Llamar $web "GET" "/api/admin/orders" $null $jarNormal
        Chk "B20a lista -> 403" ($r.Status -eq 403) "HTTP $($r.Status)"
        $r = Llamar $web "GET" "/api/admin/orders/$g" $null $jarNormal
        Chk "B20b detalle -> 403" ($r.Status -eq 403) "HTTP $($r.Status)"
        $r = Llamar $web "POST" "/api/admin/orders/$g/status" $ok $jarNormal $false $web
        Chk "B20c cambio de estado -> 403, no-store" ($r.Status -eq 403 -and $r.NoStore) "HTTP $($r.Status)"

        ""
        "--- Admin ---"
        $r = Llamar $web "GET" "/api/admin/orders" $null $jarAdmin
        Chk "B21a lista -> 200 y un arreglo" ($r.Status -eq 200 -and ($r.Body.Trim() -eq "[]" -or $r.Body.Trim().StartsWith("["))) "HTTP $($r.Status)"
        $r = Llamar $web "GET" "/api/admin/orders?status=Pendiente&otro=1" $null $jarAdmin
        Chk "B21b filtro válido con un parámetro extra (se ignora) -> 200" ($r.Status -eq 200) "HTTP $($r.Status)"
        $r = Llamar $web "GET" "/api/admin/orders/$g" $null $jarAdmin
        Chk "B21c detalle inexistente -> 404 pedido_no_encontrado" ($r.Status -eq 404 -and $r.Json.code -eq "pedido_no_encontrado") "HTTP $($r.Status)"
        $r = Llamar $web "POST" "/api/admin/orders/$g/status" $ok $jarAdmin $false $web
        $claves = if ($r.Json) { (@($r.Json.PSObject.Properties.Name) | Sort-Object) -join "," } else { "" }
        Chk "B21d cambio de estado de un pedido inexistente -> 404 con solo code y message" ($r.Status -eq 404 -and $claves -eq "code,message") "HTTP $($r.Status) claves: $claves"

        ""
        "--- Todas las respuestas del intermediario ---"
        $sinCache = @($global:respuestas | Where-Object { -not $_.NoStore -and $_.Status -ne 405 })
        Chk "B30 todas llevan Cache-Control: no-store (salvo el 405)" ($sinCache.Count -eq 0) "$($sinCache.Count) sin la cabecera"
        $fuga = @($global:respuestas | Where-Object { $_.Body -match '(?i)exception|stacktrace|\bat [A-Za-z_.]+\(|microsoft\.|system\.|eyJ|internalapi|x-internal' })
        Chk "B31 ninguna respuesta filtra trazas, tokens ni claves internas" ($fuga.Count -eq 0) "$($fuga.Count) sospechosas"

        ""
        "RESUMEN: $global:pasan pasan, $global:fallan fallan"
        "(No cubierto: API caída -> 503 genérico. Se prueba a mano deteniendo la API.)"
    }
    finally {
        ""
        "Limpieza..."
        Sql "DELETE FROM AspNetUserRoles WHERE RoleId = (SELECT Id FROM AspNetRoles WHERE Name = 'admin') AND UserId IN (SELECT Id FROM AspNetUsers WHERE Email LIKE 'bffadm%')" | Out-Null
        Remove-Item $jarNormal, $jarAdmin -ErrorAction SilentlyContinue
        "Usuarios de prueba que aún tienen rol admin: " + (Sql "SELECT COUNT(*) FROM AspNetUserRoles ur JOIN AspNetUsers u ON u.Id = ur.UserId WHERE u.Email LIKE 'bffadm%' AND ur.RoleId = (SELECT Id FROM AspNetRoles WHERE Name = 'admin')" | Select-Object -First 1)
    }
}
