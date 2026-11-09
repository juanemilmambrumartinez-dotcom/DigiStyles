function Probar-Lectura {
    $ErrorActionPreference = 'Stop'
    $base = "http://localhost:5008"; $srv = "localhost"; $db = "DigiStylesDev"
    $respaldo = "C:\Temp\stock-lectura.csv"
    $global:pasan = 0; $global:fallan = 0
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
            $tmp = Join-Path $env:TEMP ("ds-lec-" + [guid]::NewGuid().ToString("N") + ".json")
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
    function Cuenta($r) { if ($r.Body.Trim() -eq "[]") { 0 } else { @($r.Json).Count } }
    function Cuerpo($vid, $qty, $metodo, $total) {
        ([ordered]@{
            lines = [object[]]@(@{ variantId = $vid; quantity = $qty })
            paymentMethod = $metodo
            contact = [ordered]@{ name = "Cliente Prueba"; phone = "8095550000"; address = "Calle de Prueba 1"; city = "Santo Domingo"; note = $null }
            expectedTotal = $total
        }) | ConvertTo-Json -Depth 6 -Compress
    }
    function CartRef($vid, $qty) {
        $j = ConvertTo-Json -InputObject @(@{ variantId = $vid; quantity = $qty }) -Compress
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
    function CancelarParalelo($token, $id, $n) {
        $tasks = New-Object System.Collections.Generic.List[System.Threading.Tasks.Task[System.Net.Http.HttpResponseMessage]]
        1..$n | ForEach-Object {
            $req = New-Object System.Net.Http.HttpRequestMessage([System.Net.Http.HttpMethod]::Post, "$base/api/orders/$id/cancel")
            $req.Headers.TryAddWithoutValidation("Authorization", "Bearer $token") | Out-Null
            $req.Content = New-Object System.Net.Http.StringContent("{}", [System.Text.Encoding]::UTF8, "application/json")
            $tasks.Add($client.SendAsync($req))
        }
        [System.Threading.Tasks.Task]::WaitAll($tasks.ToArray())
        foreach ($t in $tasks) { [int]$t.Result.StatusCode }
    }

    $p = Invoke-RestMethod -Uri "$base/api/products"
    $lista = $null
    foreach ($n in "items","products","data","results") { if ($p.$n) { $lista = $p.$n; break } }
    if (-not $lista) { $lista = $p }
    $vA = $null
    foreach ($prod in (@($lista) | Select-Object -First 12)) {
        if ($vA -or -not $prod.slug) { continue }
        $d = Invoke-RestMethod -Uri "$base/api/products/$($prod.slug)"
        foreach ($v in @($d.variants)) { foreach ($n in "variantId","id") { if (-not $vA -and $v.$n) { $vA = [int]$v.$n } } }
    }
    if (-not $vA) { "No encontré ninguna variante. No se cambió nada."; return }
    $orig = Stock $vA
    "$vA,$orig" | Set-Content $respaldo -Encoding ASCII
    "Variante de prueba: $vA (stock original $orig, guardado en $respaldo)"

    try {
        Sql "UPDATE ProductVariants SET Stock = 50 WHERE Id = $vA" | Out-Null
        Chk "L00 preparación del stock de prueba (50)" ((Stock $vA) -eq 50)

        "`nCreando 2 usuarios de prueba (unos 15 segundos)..."
        $u1 = NuevoUsuario "ordlect1-"; Start-Sleep -Seconds 13; $u2 = NuevoUsuario "ordlect2-"
        $t1 = $u1.Token; $t2 = $u2.Token

        $ref = CartRef $vA 1
        $r = Llamar "POST" "/api/orders" (Cuerpo $vA 1 "transferencia" 1) $t1 (Clave)
        $envio = [decimal]$r.Json.details.total - $ref.Subtotal
        function Crear($qty, $metodo) { Llamar "POST" "/api/orders" (Cuerpo $vA $qty $metodo ($ref.Unit * $qty + $envio)) $t1 (Clave) }
        $r1 = Crear 2 "transferencia"; $r2 = Crear 1 "contra_entrega"; $r3 = Crear 3 "transferencia"
        $o1 = $r1.Json; $o2 = $r2.Json; $o3 = $r3.Json
        Chk "L00b tres pedidos pendientes creados (201) y stock 50 -> 44" ($r1.Status -eq 201 -and $r2.Status -eq 201 -and $r3.Status -eq 201 -and (Stock $vA) -eq 44) "estados $($r1.Status), $($r2.Status), $($r3.Status)"

        "`n--- Lista y detalle ---"
        $r = Llamar "GET" "/api/orders"
        Chk "L01 lista sin token -> 401" ($r.Status -eq 401)
        $r = Llamar "GET" "/api/orders" $null $t1
        $items = @($r.Json)
        $campos = @($items[0].PSObject.Properties.Name)
        Chk "L02a lista del usuario -> 200 con sus 3 pedidos, el más reciente primero" ($r.Status -eq 200 -and (Cuenta $r) -eq 3 -and $items[0].id -eq $o3.id) "estado $($r.Status), cuenta $(Cuenta $r)"
        Chk "L02b la lista es un resumen: sin datos de entrega, bancarios ni líneas, y con no-store" ($campos -contains "orderNumber" -and $campos -contains "totalItems" -and -not ($campos -contains "delivery") -and -not ($campos -contains "bankTransfer") -and -not ($campos -contains "lines") -and $r.NoStore)
        $r = Llamar "GET" "/api/orders" $null $t2
        Chk "L03 la lista de otro usuario está vacía" ($r.Status -eq 200 -and (Cuenta $r) -eq 0) "estado $($r.Status), cuerpo $($r.Body)"
        $r = Llamar "GET" "/api/orders/$($o1.id)" $null $t1
        Chk "L04 detalle propio, transferencia pendiente -> 200 con entrega, líneas y datos bancarios" ($r.Status -eq 200 -and $r.Json.id -eq $o1.id -and $r.Json.lines.Count -eq 1 -and $null -ne $r.Json.delivery -and $null -ne $r.Json.bankTransfer -and $r.NoStore) "estado $($r.Status)"
        $r = Llamar "GET" "/api/orders/$($o2.id)" $null $t1
        Chk "L05 detalle de contra entrega -> sin datos bancarios" ($r.Status -eq 200 -and $null -eq $r.Json.bankTransfer)
        $rAjeno = Llamar "GET" "/api/orders/$($o1.id)" $null $t2
        $rNoExiste = Llamar "GET" "/api/orders/$([guid]::NewGuid())" $null $t1
        Chk "L06 pedido ajeno -> 404, con exactamente la misma respuesta que uno inexistente" ($rAjeno.Status -eq 404 -and $rNoExiste.Status -eq 404 -and $rAjeno.Body -ceq $rNoExiste.Body) "ajeno: $($rAjeno.Body)  inexistente: $($rNoExiste.Body)"
        $r = Llamar "GET" "/api/orders/abc" $null $t1
        Chk "L07 id que no es guid -> 404" ($r.Status -eq 404) "estado $($r.Status)"

        "`n--- Cancelación ---"
        $r = Llamar "POST" "/api/orders/$($o1.id)/cancel" "{}"
        Chk "L08 cancelar sin token -> 401" ($r.Status -eq 401)
        $r = Llamar "POST" "/api/orders/$($o1.id)/cancel" "{}" $t2
        Chk "L09 cancelar el pedido de otro usuario -> 404, sin cambios" ($r.Status -eq 404 -and (EstadoBd $o1.id) -eq "Pendiente" -and (Stock $vA) -eq 44) "estado $($r.Status)"
        $r = Llamar "POST" "/api/orders/$($o1.id)/cancel" "{}" $t1
        Chk "L10a cancelar un pedido propio pendiente -> 200, Cancelado, sin datos bancarios, no-store" ($r.Status -eq 200 -and $r.Json.status -eq "Cancelado" -and $null -eq $r.Json.bankTransfer -and $r.NoStore) "estado $($r.Status)  cuerpo: $($r.Body)"
        Chk "L10b el stock volvió (44 -> 46) y la base dice Cancelado" ((Stock $vA) -eq 46 -and (EstadoBd $o1.id) -eq "Cancelado")
        $r = Llamar "POST" "/api/orders/$($o1.id)/cancel" "{}" $t1
        Chk "L11 cancelar otra vez -> 200 y el stock no se devuelve de nuevo (sigue en 46)" ($r.Status -eq 200 -and $r.Json.status -eq "Cancelado" -and (Stock $vA) -eq 46) "estado $($r.Status)"

        "`n--- Cancelación doble: 6 peticiones simultáneas sobre el mismo pedido (3 unidades) ---"
        $cods = @(CancelarParalelo $t1 $o3.id 6)
        "      códigos: " + (($cods | Sort-Object) -join ", ")
        Chk "L12a las 6 responden 200" (@($cods | Where-Object { $_ -eq 200 }).Count -eq 6)
        Chk "L12b el stock volvió UNA sola vez (46 -> 49), nunca 52 ni más" ((Stock $vA) -eq 49) "stock actual $(Stock $vA)"
        Chk "L12c el pedido quedó Cancelado" ((EstadoBd $o3.id) -eq "Cancelado")

        "`n--- Pedido que ya no se puede cancelar ---"
        Sql "UPDATE Orders SET Status = 'Confirmado' WHERE Id = '$($o2.id)'" | Out-Null
        $r = Llamar "POST" "/api/orders/$($o2.id)/cancel" "{}" $t1
        Chk "L13 cancelar un pedido Confirmado -> 409 no_cancelable, sin tocar el stock (49)" ($r.Status -eq 409 -and $r.Json.code -eq "no_cancelable" -and (Stock $vA) -eq 49 -and (EstadoBd $o2.id) -eq "Confirmado") "estado $($r.Status)"

        "`n--- Cancelar libera el tope de pendientes ---"
        $r = Crear 1 "contra_entrega"
        Chk "L14 con 0 pedidos pendientes se puede crear otro (201) y el stock baja a 48" ($r.Status -eq 201 -and (Stock $vA) -eq 48) "estado $($r.Status)  cuerpo: $($r.Body)"

        "`nRESUMEN: $($global:pasan) pasan, $($global:fallan) fallan"
    }
    finally {
        "`nLimpieza..."
        Sql "UPDATE ProductVariants SET Stock = $orig WHERE Id = $vA" | Out-Null
        Sql "DELETE FROM Orders WHERE UserId IN (SELECT Id FROM AspNetUsers WHERE Email LIKE 'ordlect%@example.com')" | Out-Null
        "Stock restaurado: $vA=" + (Stock $vA) + " (original $orig)"
        "Pedidos de prueba que quedan: " + (Sql "SELECT COUNT(*) FROM Orders o JOIN AspNetUsers u ON u.Id = o.UserId WHERE u.Email LIKE 'ordlect%@example.com'" | Select-Object -First 1)
    }
}
