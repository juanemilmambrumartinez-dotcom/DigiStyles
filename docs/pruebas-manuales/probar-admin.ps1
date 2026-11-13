function Probar-Admin {
    $ErrorActionPreference = 'Stop'
    $base = "http://localhost:5008"; $srv = "localhost"; $db = "DigiStylesDev"
    $respaldo = "C:\Temp\stock-admin.csv"
    $vid = 2
    $global:pasan = 0; $global:fallan = 0; $global:escrituras = 0
    Add-Type -AssemblyName System.Net.Http
    $client = New-Object System.Net.Http.HttpClient

    function Chk($nombre, $ok, $detalle = "") {
        if ($ok) { $global:pasan++; "PASA   $nombre" } else { $global:fallan++; "FALLA  $nombre   $detalle" }
    }
    function Sql($q) { & sqlcmd -S $srv -E -d $db -h -1 -W -Q "SET NOCOUNT ON; $q" }
    function Stock($id) {
        $v = Sql "SELECT Stock FROM ProductVariants WHERE Id = $id" | Select-Object -First 1
        if ($v -notmatch '^\d+$') { throw "No pude leer el stock de la variante $id" }
        [int]$v
    }
    function EstadoBd($id) { (Sql "SELECT Status FROM Orders WHERE Id = '$id'" | Select-Object -First 1).Trim() }
    function Clave { "t" + [guid]::NewGuid().ToString("N").Substring(0, 20) }
    function Llamar($metodo, $ruta, $json = $null, $token = $null, $key = $null) {
        $a = @("-s", "-i", "-X", $metodo, "$base$ruta", "-H", "Expect:")
        if ($token) { $a += @("-H", "Authorization: Bearer $token") }
        if ($key) { $a += @("-H", "Idempotency-Key: $key") }
        $tmp = $null
        if ($null -ne $json) {
            $tmp = Join-Path $env:TEMP ("ds-adm-" + [guid]::NewGuid().ToString("N") + ".json")
            [System.IO.File]::WriteAllText($tmp, $json)
            $a += @("-H", "Content-Type: application/json", "--data-binary", "@$tmp")
        }
        $salida = @(& curl.exe @a)
        if ($tmp) { Remove-Item $tmp -ErrorAction SilentlyContinue }
        $estado = [int](($salida[0] -split " ")[1])
        $cache = $salida | Where-Object { $_ -match "^(?i)cache-control:" } | Select-Object -First 1
        $cuerpo = [string]$salida[-1]
        $parsed = $null
        try { $parsed = $cuerpo | ConvertFrom-Json } catch { }
        [pscustomobject]@{ Status = $estado; NoStore = [bool]($cache -match "no-store"); Body = $cuerpo; Json = $parsed }
    }
    function CuerpoNoJson($ruta, $token) {
        $salida = @(& curl.exe -s -i -X POST "$base$ruta" -H "Expect:" -H "Authorization: Bearer $token" -H "Content-Type: text/plain" --data-binary "x")
        [int](($salida[0] -split " ")[1])
    }
    function Cuenta($r) { if ($r.Body.Trim() -eq "[]") { 0 } else { @($r.Json).Count } }
    function Cuerpo($variante, $qty, $metodo, $total) {
        ([ordered]@{
            lines = [object[]]@(@{ variantId = $variante; quantity = $qty })
            paymentMethod = $metodo
            contact = [ordered]@{ name = "Cliente Prueba"; phone = "8095550000"; address = "Calle de Prueba 1"; city = "Santo Domingo"; note = $null }
            expectedTotal = $total
        }) | ConvertTo-Json -Depth 6 -Compress
    }
    function CartRef($variante, $qty) {
        $j = ConvertTo-Json -InputObject @(@{ variantId = $variante; quantity = $qty }) -Compress
        $r = Llamar "POST" "/api/cart/validate" $j
        [pscustomobject]@{ Unit = [decimal]$r.Json.lines[0].unitPrice; Subtotal = [decimal]$r.Json.total }
    }
    function NuevoUsuario($prefijo) {
        $correo = "$prefijo$(Get-Random)@example.com"
        $cuerpo = @{ name = "Prueba $prefijo"; email = $correo; password = "ClavePrueba123" } | ConvertTo-Json -Compress
        $r = Llamar "POST" "/api/auth/register" $cuerpo
        if ($r.Status -ne 200 -and $r.Status -ne 201) { throw "El registro de $correo falló con el código $($r.Status)" }
        [pscustomobject]@{ Email = $correo; Token = $r.Json.accessToken }
    }
    function Login($correo) {
        $r = Llamar "POST" "/api/auth/login" (@{ email = $correo; password = "ClavePrueba123" } | ConvertTo-Json -Compress)
        if ($r.Status -ne 200 -or -not $r.Json.accessToken) { throw "El login de $correo falló con el código $($r.Status)" }
        $r.Json.accessToken
    }
    function CrearPedido($token, $metodo, $qty) {
        $ref = CartRef $vid $qty
        $total = $ref.Subtotal + $envio
        $r = Llamar "POST" "/api/orders" (Cuerpo $vid $qty $metodo $total) $token (Clave)
        if ($r.Status -ne 201) { throw "No pude crear el pedido de prueba (código $($r.Status)): $($r.Body)" }
        [string]$r.Json.id
    }
    # El limite de escritura de admin es 10 por minuto: se espera antes de pasarlo.
    function Espera($n) {
        if ($global:escrituras + $n -gt 9) {
            "      (esperando 62 s para respetar el límite de 10 escrituras por minuto...)"
            Start-Sleep -Seconds 62
            $global:escrituras = 0
        }
        $global:escrituras += $n
    }
    function AdminEstado($token, $id, $estado) {
        Espera 1
        Llamar "POST" "/api/admin/orders/$id/status" ('{"status":"' + $estado + '"}') $token
    }
    function Trans($nombre, $id, $destino, $http, $codigo, $enBd) {
        $r = AdminEstado $at $id $destino
        $ok = ($r.Status -eq $http) -and ($enBd -eq (EstadoBd $id))
        if ($codigo) { $ok = $ok -and ($r.Json.code -eq $codigo) }
        if ($http -eq 200) { $ok = $ok -and ($r.Json.status -eq $destino) }
        Chk $nombre $ok "HTTP $($r.Status) $($r.Body)"
    }
    function Paralelo($peticiones) {
        $tareas = New-Object System.Collections.ArrayList
        foreach ($p in $peticiones) {
            $req = New-Object System.Net.Http.HttpRequestMessage([System.Net.Http.HttpMethod]::Post, $p.Url)
            [void]$req.Headers.TryAddWithoutValidation("Authorization", "Bearer " + $p.Token)
            $req.Content = New-Object System.Net.Http.StringContent($p.Body, [System.Text.Encoding]::UTF8, "application/json")
            [void]$tareas.Add($client.SendAsync($req))
        }
        [void][System.Threading.Tasks.Task]::WaitAll([System.Threading.Tasks.Task[]]$tareas.ToArray())
        @($tareas | ForEach-Object { [int]$_.Result.StatusCode })
    }

    # --- Respaldo del stock (si quedó uno de una ejecución interrumpida, no se pisa) ---
    $orig = Stock $vid
    if (Test-Path $respaldo) {
        $g = (Get-Content $respaldo | Select-Object -First 1) -split ","
        if ([int]$g[0] -eq $vid -and [int]$g[1] -ne $orig) {
            throw "Existe $respaldo con stock original $($g[1]) y ahora hay $orig. Revisa el CSV, restaura el stock y bórralo antes de repetir."
        }
    }
    Set-Content -Path $respaldo -Value "$vid,$orig" -Encoding ascii
    "Variante de prueba: $vid (stock original $orig, guardado en $respaldo)"
    "Este script espera 62 s varias veces por el límite de escrituras de admin (unos 4 a 5 minutos en total)."

    try {
        Sql "UPDATE ProductVariants SET Stock = 50 WHERE Id = $vid" | Out-Null
        Chk "A00 preparación del stock de prueba (50)" ((Stock $vid) -eq 50)

        ""
        "Creando 2 usuarios de prueba (unos 15 segundos)..."
        $cli = NuevoUsuario "admtestcli"
        Start-Sleep -Seconds 15
        $adm = NuevoUsuario "admtestadm"
        Sql "INSERT INTO AspNetUserRoles (UserId, RoleId) SELECT u.Id, r.Id FROM AspNetUsers u CROSS JOIN AspNetRoles r WHERE u.Email = '$($adm.Email)' AND r.Name = 'admin'" | Out-Null
        $tieneRol = Sql "SELECT COUNT(*) FROM AspNetUserRoles ur JOIN AspNetUsers u ON u.Id = ur.UserId JOIN AspNetRoles r ON r.Id = ur.RoleId WHERE u.Email = '$($adm.Email)' AND r.Name = 'admin'" | Select-Object -First 1
        Chk "A00b el usuario admin tiene el rol admin en la base" ($tieneRol -eq "1")
        $at = Login $adm.Email
        $ct = $cli.Token

        $infoEnvio = Llamar "GET" "/api/checkout/info"
        $envio = [decimal]$infoEnvio.Json.shippingCost
        $o1 = CrearPedido $ct "transferencia" 1
        $o2 = CrearPedido $ct "contra_entrega" 2
        $o3 = CrearPedido $ct "transferencia" 3
        $s0 = Stock $vid
        Chk "A00c tres pedidos pendientes creados y stock 50 -> $s0" ($s0 -eq 44) "stock actual $s0"

        ""
        "--- Autenticación y rol ---"
        $rutas = @(
            @("GET", "/api/admin/orders", $null),
            @("GET", "/api/admin/orders/$o1", $null),
            @("POST", "/api/admin/orders/$o1/status", '{"status":"Confirmado"}')
        )
        $sin = @(); $con = @()
        foreach ($ru in $rutas) {
            $sin += (Llamar $ru[0] $ru[1] $ru[2]).Status
            $con += (Llamar $ru[0] $ru[1] $ru[2] $ct).Status
        }
        Chk "A01 sin token -> 401 en las tres rutas" (($sin -join ",") -eq "401,401,401") ($sin -join ",")
        Chk "A02a usuario sin rol admin -> 403 en las tres rutas" (($con -join ",") -eq "403,403,403") ($con -join ",")
        Chk "A02b el 403 no cambió el pedido" ((EstadoBd $o1) -eq "Pendiente")

        ""
        "--- Lista y detalle (admin) ---"
        $l = Llamar "GET" "/api/admin/orders" $null $at
        $ids = @($o1, $o2, $o3)
        Chk "A03a lista admin -> 200 con los 3 pedidos de prueba" ($l.Status -eq 200 -and @($l.Json | Where-Object { $_.id -in $ids }).Count -eq 3) "HTTP $($l.Status)"
        $item = @($l.Json | Where-Object { $_.id -eq $o1 })[0]
        Chk "A03b la lista es un resumen: nombre de contacto y artículos, sin entrega, correo ni datos bancarios" ($null -ne $item -and $item.contactName -eq "Cliente Prueba" -and $item.totalItems -eq 1 -and $null -eq $item.address -and $null -eq $item.userEmail -and $null -eq $item.bankTransfer)
        Chk "A03c la lista admin lleva Cache-Control: no-store" $l.NoStore

        $f = Llamar "GET" "/api/admin/orders?status=Pendiente" $null $at
        Chk "A04a filtro Pendiente -> solo pendientes, incluye el pedido 1" ($f.Status -eq 200 -and @($f.Json | Where-Object { $_.status -ne "Pendiente" }).Count -eq 0 -and @($f.Json | Where-Object { $_.id -eq $o1 }).Count -eq 1)
        $f = Llamar "GET" "/api/admin/orders?status=Cancelado" $null $at
        Chk "A04b filtro Cancelado -> ninguno de los de prueba (aún no se cancela nada)" ($f.Status -eq 200 -and @($f.Json | Where-Object { $_.id -in $ids }).Count -eq 0)
        $f = Llamar "GET" "/api/admin/orders?status=Inventado" $null $at
        Chk "A04c estado inventado -> 400 solicitud_invalida" ($f.Status -eq 400 -and $f.Json.code -eq "solicitud_invalida") "HTTP $($f.Status)"
        $f = Llamar "GET" "/api/admin/orders?status=pendiente" $null $at
        Chk "A04d estado en minúscula -> 400 (la capitalización es exacta)" ($f.Status -eq 400) "HTTP $($f.Status)"

        $d = Llamar "GET" "/api/admin/orders/$o1" $null $at
        Chk "A05a detalle -> 200 con correo del dueño, entrega y una línea" ($d.Status -eq 200 -and $d.Json.userEmail -ieq $cli.Email -and $d.Json.delivery.name -eq "Cliente Prueba" -and @($d.Json.lines).Count -eq 1 -and $d.Json.status -eq "Pendiente") "HTTP $($d.Status)"
        Chk "A05b detalle de transferencia pendiente: bankTransfer null y sin campos de seguridad" ($null -eq $d.Json.bankTransfer -and $d.Body -notmatch "(?i)passwordhash|securitystamp|concurrencystamp")
        $d2 = Llamar "GET" "/api/admin/orders/$o2" $null $at
        Chk "A05c detalle de contra entrega -> 200, método contra_entrega" ($d2.Status -eq 200 -and $d2.Json.paymentMethod -eq "contra_entrega" -and $null -eq $d2.Json.bankTransfer)
        $x = Llamar "GET" "/api/admin/orders/$([guid]::NewGuid())" $null $at
        Chk "A05d pedido inexistente -> 404 pedido_no_encontrado" ($x.Status -eq 404 -and $x.Json.code -eq "pedido_no_encontrado") "HTTP $($x.Status)"
        $x = Llamar "GET" "/api/admin/orders/no-es-guid" $null $at
        Chk "A05e id que no es guid -> 400" ($x.Status -eq 400) "HTTP $($x.Status)"

        ""
        "--- Validación del cambio de estado ---"
        Espera 1
        Chk "A06a Content-Type distinto de JSON -> 400" ((CuerpoNoJson "/api/admin/orders/$o1/status" $at) -eq 400)
        $r = AdminEstado $at $o1 "Inventado"
        Chk "A06b estado inventado -> 400 y el pedido no cambia" ($r.Status -eq 400 -and (EstadoBd $o1) -eq "Pendiente") "HTTP $($r.Status)"
        $r = AdminEstado $at $o1 "confirmado"
        Chk "A06c estado en minúscula -> 400 y el pedido no cambia" ($r.Status -eq 400 -and (EstadoBd $o1) -eq "Pendiente") "HTTP $($r.Status)"
        Espera 1
        $x = Llamar "POST" "/api/admin/orders/no-es-guid/status" '{"status":"Confirmado"}' $at
        Chk "A06d id que no es guid -> 400" ($x.Status -eq 400) "HTTP $($x.Status)"
        $r = AdminEstado $at ([guid]::NewGuid()) "Confirmado"
        Chk "A06e pedido inexistente -> 404 pedido_no_encontrado" ($r.Status -eq 404 -and $r.Json.code -eq "pedido_no_encontrado") "HTTP $($r.Status)"

        ""
        "--- Transiciones (pedido 1) ---"
        Trans "A10a Pendiente -> Enviado: 409 transicion_invalida" $o1 "Enviado" 409 "transicion_invalida" "Pendiente"
        Trans "A10b Pendiente -> Entregado: 409 transicion_invalida" $o1 "Entregado" 409 "transicion_invalida" "Pendiente"
        Trans "A10c Pendiente -> Confirmado: 200 (el cuerpo con {`"status`"} en minúscula funciona)" $o1 "Confirmado" 200 $null "Confirmado"
        Trans "A10d Confirmado -> Confirmado otra vez: 200 idempotente" $o1 "Confirmado" 200 $null "Confirmado"
        Trans "A10e Confirmado -> Pendiente: 409 (no se retrocede)" $o1 "Pendiente" 409 "transicion_invalida" "Confirmado"
        Trans "A10f Confirmado -> Entregado: 409 (no se salta Enviado)" $o1 "Entregado" 409 "transicion_invalida" "Confirmado"
        Trans "A10g Confirmado -> Enviado: 200" $o1 "Enviado" 200 $null "Enviado"
        Trans "A10h Enviado -> Cancelado: 409 (un pedido enviado no se cancela)" $o1 "Cancelado" 409 "transicion_invalida" "Enviado"
        Trans "A10i Enviado -> Entregado: 200" $o1 "Entregado" 200 $null "Entregado"
        Trans "A10j Entregado -> Cancelado: 409" $o1 "Cancelado" 409 "transicion_invalida" "Entregado"
        Trans "A10k Entregado -> Enviado: 409" $o1 "Enviado" 409 "transicion_invalida" "Entregado"
        Chk "A10l ninguna transición sin cancelar tocó el stock (sigue en $s0)" ((Stock $vid) -eq $s0) "stock actual $(Stock $vid)"

        ""
        "--- Cancelar desde admin ---"
        Trans "A11a pedido 2 Pendiente -> Cancelado: 200" $o2 "Cancelado" 200 $null "Cancelado"
        Chk "A11b el stock volvió ($s0 -> $($s0 + 2)) una vez" ((Stock $vid) -eq ($s0 + 2)) "stock actual $(Stock $vid)"
        Trans "A11c cancelar otra vez: 200 idempotente" $o2 "Cancelado" 200 $null "Cancelado"
        Chk "A11d el stock no se devuelve de nuevo (sigue en $($s0 + 2))" ((Stock $vid) -eq ($s0 + 2)) "stock actual $(Stock $vid)"
        Trans "A11e Cancelado -> Confirmado: 409" $o2 "Confirmado" 409 "transicion_invalida" "Cancelado"
        Trans "A11f pedido 3 Pendiente -> Confirmado: 200" $o3 "Confirmado" 200 $null "Confirmado"
        Trans "A11g pedido 3 Confirmado -> Cancelado: 200" $o3 "Cancelado" 200 $null "Cancelado"
        Chk "A11h el stock volvió por el pedido 3 ($($s0 + 2) -> $($s0 + 5))" ((Stock $vid) -eq ($s0 + 5)) "stock actual $(Stock $vid)"
        $dc = Llamar "GET" "/api/admin/orders/$o2" $null $at
        Chk "A11i el detalle de un pedido cancelado no trae datos bancarios" ($dc.Status -eq 200 -and $dc.Json.status -eq "Cancelado" -and $null -eq $dc.Json.bankTransfer)

        ""
        "--- Cancelación simultánea: 5 peticiones de admin sobre el mismo pedido ---"
        $o4 = CrearPedido $ct "contra_entrega" 2
        $s4 = Stock $vid
        Espera 5
        $pet = @(1..5 | ForEach-Object { @{ Url = "$base/api/admin/orders/$o4/status"; Token = $at; Body = '{"status":"Cancelado"}' } })
        $codigos = Paralelo $pet
        "      códigos: " + ($codigos -join ", ")
        Chk "A12a las 5 responden 200" (@($codigos | Where-Object { $_ -ne 200 }).Count -eq 0) ($codigos -join ",")
        Chk "A12b el stock volvió UNA sola vez ($s4 -> $($s4 + 2)), nunca más" ((Stock $vid) -eq ($s4 + 2)) "stock actual $(Stock $vid)"
        Chk "A12c el pedido quedó Cancelado" ((EstadoBd $o4) -eq "Cancelado")

        ""
        "--- Cancelación simultánea: admin y dueño a la vez (3 + 3 peticiones) ---"
        $o5 = CrearPedido $ct "contra_entrega" 2
        $s5 = Stock $vid
        Espera 3
        $pet = @()
        foreach ($i in 1..3) {
            $pet += @{ Url = "$base/api/admin/orders/$o5/status"; Token = $at; Body = '{"status":"Cancelado"}' }
            $pet += @{ Url = "$base/api/orders/$o5/cancel"; Token = $ct; Body = "{}" }
        }
        $codigos = Paralelo $pet
        "      códigos: " + ($codigos -join ", ")
        Chk "A13a las 6 responden 200" (@($codigos | Where-Object { $_ -ne 200 }).Count -eq 0) ($codigos -join ",")
        Chk "A13b el stock volvió UNA sola vez ($s5 -> $($s5 + 2))" ((Stock $vid) -eq ($s5 + 2)) "stock actual $(Stock $vid)"
        Chk "A13c el pedido quedó Cancelado" ((EstadoBd $o5) -eq "Cancelado")

        ""
        "--- Límite de escrituras de admin (10 por minuto) ---"
        $global:escrituras = 9
        Espera 1
        $codigos = @(); $ultima = $null
        foreach ($i in 1..12) {
            $ultima = Llamar "POST" "/api/admin/orders/$([guid]::NewGuid())/status" '{"status":"Confirmado"}' $at
            $codigos += $ultima.Status
        }
        "      códigos: " + ($codigos -join ", ")
        Chk "A14a las primeras responden 404 y después llega un 429" (($codigos[0] -eq 404) -and ($codigos -contains 429)) ($codigos -join ",")
        Chk "A14b la respuesta 429 trae limite_excedido y no-store" ($ultima.Status -eq 429 -and $ultima.Json.code -eq "limite_excedido" -and $ultima.NoStore) "HTTP $($ultima.Status) $($ultima.Body)"

        ""
        "RESUMEN: $global:pasan pasan, $global:fallan fallan"
    }
    finally {
        ""
        "Limpieza..."
        Sql "DELETE FROM AspNetUserRoles WHERE RoleId = (SELECT Id FROM AspNetRoles WHERE Name = 'admin') AND UserId IN (SELECT Id FROM AspNetUsers WHERE Email LIKE 'admtest%')" | Out-Null
        Sql "DELETE FROM Orders WHERE UserId IN (SELECT Id FROM AspNetUsers WHERE Email LIKE 'admtest%')" | Out-Null
        if (Test-Path $respaldo) {
            $p = (Get-Content $respaldo | Select-Object -First 1) -split ","
            Sql "UPDATE ProductVariants SET Stock = $($p[1]) WHERE Id = $($p[0])" | Out-Null
            "Stock restaurado: $($p[0])=$((Stock ([int]$p[0]))) (original $($p[1]))"
        }
        "Pedidos de prueba que quedan: " + (Sql "SELECT COUNT(*) FROM Orders WHERE UserId IN (SELECT Id FROM AspNetUsers WHERE Email LIKE 'admtest%')" | Select-Object -First 1)
        "Usuarios de prueba que aún tienen rol admin: " + (Sql "SELECT COUNT(*) FROM AspNetUserRoles ur JOIN AspNetUsers u ON u.Id = ur.UserId WHERE u.Email LIKE 'admtest%' AND ur.RoleId = (SELECT Id FROM AspNetRoles WHERE Name = 'admin')" | Select-Object -First 1)
    }
}