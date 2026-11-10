function Probar-Bff {
    $ErrorActionPreference = 'Stop'
    $web = "http://localhost:3000"; $api = "http://localhost:5008"
    $srv = "localhost"; $db = "DigiStylesDev"
    $respaldo = "C:\Temp\stock-bff.csv"
    $global:pasan = 0; $global:fallan = 0
    $tmp = Join-Path $env:TEMP "ds-bff-ped.json"
    $jarVacia = Join-Path $env:TEMP "ds-bff-vacia.txt"
    $jar1 = Join-Path $env:TEMP "ds-bff-j1.txt"
    $jar2 = Join-Path $env:TEMP "ds-bff-j2.txt"
    Remove-Item $jarVacia, $jar1, $jar2 -ErrorAction SilentlyContinue

    function Chk($nombre, $ok, $detalle = "") {
        if ($ok) { $global:pasan++; "PASA   $nombre" } else { $global:fallan++; "FALLA  $nombre   $detalle" }
    }
    function Sql($q) { & sqlcmd -S $srv -E -d $db -h -1 -W -Q "SET NOCOUNT ON; $q" }
    function Stock($id) {
        $v = Sql "SELECT Stock FROM ProductVariants WHERE Id = $id" | Select-Object -First 1
        if ($v -notmatch '^\d+$') { throw "No pude leer el stock de la variante $id" }
        [int]$v
    }
    function Clave { "t" + [guid]::NewGuid().ToString("N").Substring(0, 20) }
    function Bff($jar, $metodo, $ruta, $json = $null, $key = $null, $origin = $web, $ctype = "application/json") {
        $a = @("-s", "-i", "-X", $metodo, "$web$ruta", "-H", "Expect:", "-b", $jar, "-c", $jar)
        if ($origin) { $a += @("-H", "Origin: $origin") }
        if ($key) { $a += @("-H", "Idempotency-Key: $key") }
        if ($null -ne $json) {
            [System.IO.File]::WriteAllText($tmp, $json)
            $a += @("-H", "Content-Type: $ctype", "--data-binary", "@$tmp")
        }
        $salida = @(& curl.exe @a)
        $estado = [int](($salida[0] -split " ")[1])
        $cache = $salida | Where-Object { $_ -match "^(?i)cache-control:" } | Select-Object -First 1
        $cookies = @($salida | Where-Object { $_ -match "^(?i)set-cookie:" })
        $cuerpo = [string]$salida[-1]
        $parsed = $null
        try { $parsed = $cuerpo | ConvertFrom-Json } catch { }
        [pscustomobject]@{ Status = $estado; NoStore = [bool]($cache -match "no-store"); Cookies = $cookies; Body = $cuerpo; Json = $parsed }
    }
    function ConToken($texto) { ($texto -cmatch 'eyJ') -or ($texto -match 'accessToken|refreshToken') }
    function Cuerpo($vid, $qty, $metodo, $total, $nota = $null) {
        ([ordered]@{
            lines = [object[]]@(@{ variantId = $vid; quantity = $qty })
            paymentMethod = $metodo
            contact = [ordered]@{ name = "Cliente Prueba"; phone = "8095550000"; address = "Calle de Prueba 1"; city = "Santo Domingo"; note = $nota }
            expectedTotal = $total
        }) | ConvertTo-Json -Depth 6 -Compress
    }
    function Registrar($jar, $prefijo) {
        $correo = "$prefijo$(Get-Random)@example.com"
        $cuerpo = @{ name = "Prueba $prefijo"; email = $correo; password = "ClavePrueba123" } | ConvertTo-Json -Compress
        $r = Bff $jar "POST" "/api/auth/register" $cuerpo
        if ($r.Status -ne 200 -and $r.Status -ne 201) { throw "El registro de $correo falló con el código $($r.Status)" }
    }

    $p = Invoke-RestMethod -Uri "$api/api/products"
    $lista = $null
    foreach ($n in "items","products","data","results") { if ($p.$n) { $lista = $p.$n; break } }
    if (-not $lista) { $lista = $p }
    $vA = $null
    foreach ($prod in (@($lista) | Select-Object -First 12)) {
        if ($vA -or -not $prod.slug) { continue }
        $d = Invoke-RestMethod -Uri "$api/api/products/$($prod.slug)"
        foreach ($v in @($d.variants)) { foreach ($n in "variantId","id") { if (-not $vA -and $v.$n) { $vA = [int]$v.$n } } }
    }
    if (-not $vA) { "No encontré ninguna variante. No se cambió nada."; return }
    $orig = Stock $vA
    "$vA,$orig" | Set-Content $respaldo -Encoding ASCII
    "Variante de prueba: $vA (stock original $orig, guardado en $respaldo)"

    try {
        Sql "UPDATE ProductVariants SET Stock = 50 WHERE Id = $vA" | Out-Null
        $cart = Invoke-RestMethod -Method Post -Uri "$api/api/cart/validate" -ContentType "application/json" -Body (ConvertTo-Json -InputObject @(@{ variantId = $vA; quantity = 1 }) -Compress)
        $unit = [decimal]$cart.lines[0].unitPrice

        "`n--- Sin sesión ---"
        $info = Bff $jarVacia "GET" "/api/checkout/info" $null $null $null
        $envio = [decimal]$info.Json.shippingCost
        Chk "B01 checkout/info sin sesión -> 200, DOP, costo de envío, no-store" ($info.Status -eq 200 -and $info.Json.currency -eq "DOP" -and $envio -ge 0 -and $info.NoStore) "estado $($info.Status)  cuerpo: $($info.Body)"
        "      envío: $envio DOP"
        $total2 = $unit * 2 + $envio
        $ok2 = Cuerpo $vA 2 "transferencia" $total2
        $r = Bff $jarVacia "POST" "/api/orders" $ok2 (Clave)
        Chk "B02 crear pedido sin sesión -> 401 genérico" ($r.Status -eq 401 -and $r.Json.message -eq "No autenticado." -and $r.NoStore) "estado $($r.Status)  cuerpo: $($r.Body)"
        $r = Bff $jarVacia "GET" "/api/orders" $null $null $null
        Chk "B03 lista sin sesión -> 401" ($r.Status -eq 401)
        $r = Bff $jarVacia "GET" "/api/orders/$([guid]::NewGuid())" $null $null $null
        Chk "B04 detalle sin sesión -> 401" ($r.Status -eq 401)

        "`nCreando 2 usuarios por el intermediario (unos 15 segundos)..."
        Registrar $jar1 "bfftest1-"; Start-Sleep -Seconds 13; Registrar $jar2 "bfftest2-"

        "`n--- Validaciones del intermediario ---"
        $r = Bff $jar1 "POST" "/api/orders" $ok2 (Clave) "http://evil.example"
        Chk "B05 Origin ajeno -> 403" ($r.Status -eq 403) "estado $($r.Status)"
        $r = Bff $jar1 "POST" "/api/orders" $ok2 $null
        Chk "B06 sin Idempotency-Key -> 400" ($r.Status -eq 400) "estado $($r.Status)"
        $r = Bff $jar1 "POST" "/api/orders" $ok2 (Clave) $web "text/plain"
        Chk "B07 Content-Type texto -> 415" ($r.Status -eq 415) "estado $($r.Status)"
        $r = Bff $jar1 "POST" "/api/orders" "[]" (Clave)
        Chk "B08a cuerpo que no es objeto -> 400" ($r.Status -eq 400) "estado $($r.Status)"
        $r = Bff $jar1 "POST" "/api/orders" '{"lines":' (Clave)
        Chk "B08b JSON roto -> 400" ($r.Status -eq 400) "estado $($r.Status)"
        $r = Bff $jar1 "POST" "/api/orders" ('{"pad":"' + ("x" * 20000) + '"}') (Clave)
        Chk "B09 cuerpo de más de 16 KB -> 413, no-store" ($r.Status -eq 413 -and $r.NoStore) "estado $($r.Status)"
        $r = Bff $jar1 "GET" "/api/orders/abc" $null $null $null
        Chk "B10 id que no es guid -> 404 con el mensaje del intermediario" ($r.Status -eq 404 -and $r.Json.message -eq "El pedido no existe.") "estado $($r.Status)  cuerpo: $($r.Body)"

        "`n--- Pedido completo por el intermediario (usuario 1) ---"
        $k1 = Clave
        $r = Bff $jar1 "POST" "/api/orders" $ok2 $k1
        $o = $r.Json
        Chk "B11a crear pedido -> 201, Pendiente, DOP, con datos bancarios y no-store" ($r.Status -eq 201 -and $o.status -eq "Pendiente" -and $o.currency -eq "DOP" -and $null -ne $o.bankTransfer -and $r.NoStore) "estado $($r.Status)  cuerpo: $($r.Body)"
        Chk "B11b la respuesta no trae tokens ni cabeceras Set-Cookie" (-not (ConToken $r.Body) -and $r.Cookies.Count -eq 0)
        Chk "B11c stock descontado (50 -> 48)" ((Stock $vA) -eq 48)
        $r = Bff $jar1 "POST" "/api/orders" $ok2 $k1
        Chk "B12 misma clave y mismo contenido -> 200, mismo pedido, sin descontar de nuevo" ($r.Status -eq 200 -and $r.Json.id -eq $o.id -and (Stock $vA) -eq 48) "estado $($r.Status)"
        $r = Bff $jar1 "POST" "/api/orders" (Cuerpo $vA 2 "transferencia" $total2 "otra nota") $k1
        Chk "B13 misma clave con otro contenido -> 409 clave_reutilizada" ($r.Status -eq 409 -and $r.Json.code -eq "clave_reutilizada") "estado $($r.Status)"
        $r = Bff $jar1 "POST" "/api/orders" (Cuerpo $vA 2 "transferencia" 1) (Clave)
        Chk "B14 total equivocado -> 409 precio_cambiado con el total nuevo" ($r.Status -eq 409 -and $r.Json.code -eq "precio_cambiado" -and [decimal]$r.Json.details.total -eq $total2) "estado $($r.Status)  cuerpo: $($r.Body)"

        "`n--- Lectura ---"
        $r = Bff $jar1 "GET" "/api/orders" $null $null $null
        Chk "B15 lista -> 200 con 1 pedido, sin datos de entrega ni bancarios, sin tokens" ($r.Status -eq 200 -and @($r.Json).Count -eq 1 -and $r.Body -notmatch 'delivery|bankTransfer' -and -not (ConToken $r.Body) -and $r.NoStore) "estado $($r.Status)"
        $r = Bff $jar1 "GET" "/api/orders/$($o.id)" $null $null $null
        Chk "B16 detalle propio -> 200 con entrega y líneas" ($r.Status -eq 200 -and $r.Json.id -eq $o.id -and $null -ne $r.Json.delivery -and $r.Json.lines.Count -eq 1) "estado $($r.Status)"
        $r = Bff $jar2 "GET" "/api/orders" $null $null $null
        Chk "B17 la lista de otro usuario está vacía" ($r.Status -eq 200 -and $r.Body.Trim() -eq "[]") "cuerpo: $($r.Body)"
        $rAjeno = Bff $jar2 "GET" "/api/orders/$($o.id)" $null $null $null
        $rNo = Bff $jar2 "GET" "/api/orders/$([guid]::NewGuid())" $null $null $null
        Chk "B18 pedido ajeno -> 404, con la misma respuesta que uno inexistente" ($rAjeno.Status -eq 404 -and $rNo.Status -eq 404 -and $rAjeno.Body -ceq $rNo.Body) "ajeno: $($rAjeno.Body)  inexistente: $($rNo.Body)"

        "`n--- Cancelación ---"
        $r = Bff $jar1 "POST" "/api/orders/$($o.id)/cancel" "{}" $null "http://evil.example"
        Chk "B19 cancelar con Origin ajeno -> 403" ($r.Status -eq 403) "estado $($r.Status)"
        $r = Bff $jar2 "POST" "/api/orders/$($o.id)/cancel" "{}"
        Chk "B20 cancelar el pedido de otro usuario -> 404" ($r.Status -eq 404) "estado $($r.Status)"
        $r = Bff $jar1 "GET" "/api/orders/$($o.id)" $null $null $null
        Chk "B21 después de los intentos ajenos el pedido sigue Pendiente y el stock en 48" ($r.Json.status -eq "Pendiente" -and (Stock $vA) -eq 48)
        $r = Bff $jar1 "POST" "/api/orders/$($o.id)/cancel" "{}"
        Chk "B22a cancelar el pedido propio -> 200, Cancelado, sin datos bancarios" ($r.Status -eq 200 -and $r.Json.status -eq "Cancelado" -and $null -eq $r.Json.bankTransfer -and $r.NoStore) "estado $($r.Status)  cuerpo: $($r.Body)"
        Chk "B22b el stock volvió a 50" ((Stock $vA) -eq 50)
        $r = Bff $jar1 "POST" "/api/orders/$($o.id)/cancel" "{}"
        Chk "B23 cancelar otra vez -> 200 y el stock sigue en 50" ($r.Status -eq 200 -and (Stock $vA) -eq 50) "estado $($r.Status)"

        "`n--- Sesión sin cookie de acceso ---"
        Set-Content $jar1 (Get-Content $jar1 | Where-Object { $_ -notmatch 'digistyles_access_token' }) -Encoding ASCII
        $r = Bff $jar1 "GET" "/api/orders" $null $null $null
        Chk "B24 sin la cookie de acceso -> 401 (el cliente deberá refrescar y reintentar)" ($r.Status -eq 401 -and $r.Json.message -eq "No autenticado.")

        "`nRESUMEN: $($global:pasan) pasan, $($global:fallan) fallan"
    }
    finally {
        "`nLimpieza..."
        Sql "UPDATE ProductVariants SET Stock = $orig WHERE Id = $vA" | Out-Null
        Sql "DELETE FROM Orders WHERE UserId IN (SELECT Id FROM AspNetUsers WHERE Email LIKE 'bfftest%@example.com')" | Out-Null
        Remove-Item $jarVacia, $jar1, $jar2, $tmp -ErrorAction SilentlyContinue
        "Stock restaurado: $vA=" + (Stock $vA) + " (original $orig)"
        "Pedidos de prueba que quedan: " + (Sql "SELECT COUNT(*) FROM Orders o JOIN AspNetUsers u ON u.Id = o.UserId WHERE u.Email LIKE 'bfftest%@example.com'" | Select-Object -First 1)
    }
}
