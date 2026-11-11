function Probar-Pedidos {
    $ErrorActionPreference = 'Stop'
    $base = "http://localhost:5008"
    $srv = "localhost"
    $db = "DigiStylesDev"
    $respaldo = "C:\Temp\stock-pedidos.csv"
    $global:pasan = 0
    $global:fallan = 0
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
    function Contar($email, $filtro = "") {
        $v = Sql "SELECT COUNT(*) FROM Orders o JOIN AspNetUsers u ON u.Id = o.UserId WHERE u.Email = '$email' $filtro" | Select-Object -First 1
        if ($v -notmatch '^\d+$') { throw "No pude contar los pedidos de $email" }
        [int]$v
    }
    function Clave { "t" + [guid]::NewGuid().ToString("N").Substring(0, 20) }

    function Llamar($metodo, $ruta, $json = $null, $token = $null, $key = $null) {
        $a = @("-s", "-i", "-X", $metodo, "$base$ruta", "-H", "Expect:")
        if ($token) { $a += @("-H", "Authorization: Bearer $token") }
        if ($key) { $a += @("-H", "Idempotency-Key: $key") }
        $tmp = $null
        if ($null -ne $json) {
            $tmp = Join-Path $env:TEMP ("ds-ped-" + [guid]::NewGuid().ToString("N") + ".json")
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

    function Paralelo($items) {
        $tasks = New-Object System.Collections.Generic.List[System.Threading.Tasks.Task[System.Net.Http.HttpResponseMessage]]
        foreach ($it in $items) {
            $req = New-Object System.Net.Http.HttpRequestMessage([System.Net.Http.HttpMethod]::Post, "$base/api/orders")
            $req.Headers.TryAddWithoutValidation("Authorization", "Bearer $($it.Token)") | Out-Null
            $req.Headers.TryAddWithoutValidation("Idempotency-Key", $it.Key) | Out-Null
            $req.Content = New-Object System.Net.Http.StringContent($it.Json, [System.Text.Encoding]::UTF8, "application/json")
            $tasks.Add($client.SendAsync($req))
        }
        [System.Threading.Tasks.Task]::WaitAll($tasks.ToArray())
        foreach ($t in $tasks) {
            $r = $t.Result
            $body = $r.Content.ReadAsStringAsync().Result
            $parsed = $null
            try { $parsed = $body | ConvertFrom-Json } catch { }
            [pscustomobject]@{ Status = [int]$r.StatusCode; Json = $parsed }
        }
    }

    function Cuerpo($vid, $qty, $metodo, $total, $nota = $null, $extra = $null) {
        $h = [ordered]@{
            lines = [object[]]@(@{ variantId = $vid; quantity = $qty })
            paymentMethod = $metodo
            contact = [ordered]@{ name = "Cliente Prueba"; phone = "8095550000"; address = "Calle de Prueba 1"; city = "Santo Domingo"; note = $nota }
            expectedTotal = $total
        }
        if ($extra) { foreach ($k in $extra.Keys) { $h[$k] = $extra[$k] } }
        $h | ConvertTo-Json -Depth 6 -Compress
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

    # ---- Variantes de prueba ----
    $p = Invoke-RestMethod -Uri "$base/api/products"
    $lista = $null
    foreach ($n in "items","products","data","results") { if ($p.$n) { $lista = $p.$n; break } }
    if (-not $lista) { $lista = $p }
    $ids = New-Object System.Collections.Generic.List[int]
    foreach ($prod in (@($lista) | Select-Object -First 12)) {
        if (-not $prod.slug) { continue }
        $d = Invoke-RestMethod -Uri "$base/api/products/$($prod.slug)"
        foreach ($v in @($d.variants)) {
            $vid = $null
            foreach ($n in "variantId","id") { if ($v.$n) { $vid = [int]$v.$n; break } }
            if ($vid) { $ids.Add($vid) }
        }
    }
    $ids = @($ids | Select-Object -Unique)
    if ($ids.Count -lt 4) { "Necesito al menos 4 variantes distintas. No se cambió nada."; return }
    $vA = $ids[0]; $vB = $ids[1]; $vC = $ids[2]; $vD = $ids[3]
    "Variantes de prueba: A=$vA (stock 50), B=$vB (stock 1), C=$vC (stock 2), D=$vD (stock 0)"

    $orig = @()
    foreach ($id in @($vA, $vB, $vC, $vD)) { $orig += [pscustomobject]@{ Id = $id; Stock = (Stock $id) } }
    $orig | ForEach-Object { "$($_.Id),$($_.Stock)" } | Set-Content $respaldo -Encoding ASCII
    "Stock original guardado en ${respaldo}: " + (($orig | ForEach-Object { "$($_.Id)=$($_.Stock)" }) -join "  ")

    try {
        Sql "UPDATE ProductVariants SET Stock = 50 WHERE Id = $vA; UPDATE ProductVariants SET Stock = 1 WHERE Id = $vB; UPDATE ProductVariants SET Stock = 2 WHERE Id = $vC; UPDATE ProductVariants SET Stock = 0 WHERE Id = $vD" | Out-Null
        Chk "T00 preparación del stock de prueba" ((Stock $vA) -eq 50 -and (Stock $vB) -eq 1 -and (Stock $vC) -eq 2 -and (Stock $vD) -eq 0)

        "`nCreando 6 usuarios de prueba (unos 80 segundos)..."
        $u = @{}
        foreach ($n in 1..6) {
            $u[$n] = NuevoUsuario "ordtest$n-"
            if ($n -lt 6) { Start-Sleep -Seconds 13 }
        }
        $t1 = $u[1].Token; $t2 = $u[2].Token; $t3 = $u[3].Token; $t4 = $u[4].Token; $t5 = $u[5].Token; $t6 = $u[6].Token
        $e1 = $u[1].Email; $e4 = $u[4].Email; $e6 = $u[6].Email

        "`n--- Validaciones ---"
        $ok = Cuerpo $vA 1 "transferencia" 1
        $r = Llamar "POST" "/api/orders" $ok $null (Clave)
        Chk "T01 sin token -> 401" ($r.Status -eq 401) "estado $($r.Status)"
        $r02 = Llamar "POST" "/api/orders" $ok $t5 $null
        Chk "T02 sin Idempotency-Key -> 400 clave_invalida" ($r02.Status -eq 400 -and $r02.Json.code -eq "clave_invalida") "estado $($r02.Status)"
        $r = Llamar "POST" "/api/orders" $ok $t5 "abc"
        Chk "T03 clave demasiado corta -> 400 clave_invalida" ($r.Status -eq 400 -and $r.Json.code -eq "clave_invalida") "estado $($r.Status)"
        $r = Llamar "POST" "/api/orders" (Cuerpo $vA 1 "bitcoin" 1) $t5 (Clave)
        Chk "T04 método de pago inválido -> 400" ($r.Status -eq 400) "estado $($r.Status)"
        $sinNombre = '{"lines":[{"variantId":' + $vA + ',"quantity":1}],"paymentMethod":"transferencia","contact":{"phone":"8095550000","address":"Calle 1","city":"Santo Domingo"},"expectedTotal":1}'
        $r = Llamar "POST" "/api/orders" $sinNombre $t5 (Clave)
        Chk "T05 falta contact.name -> 400" ($r.Status -eq 400) "estado $($r.Status)"
        $r = Llamar "POST" "/api/orders" "[]" $t5 (Clave)
        Chk "T06 cuerpo que no es objeto -> 400" ($r.Status -eq 400) "estado $($r.Status)"
        $r = Llamar "POST" "/api/orders" '{"lines":' $t5 (Clave)
        Chk "T07 JSON roto -> 400" ($r.Status -eq 400) "estado $($r.Status)"
        $variantTexto = '{"lines":[{"variantId":"abc","quantity":1}],"paymentMethod":"transferencia","contact":{"name":"A","phone":"1","address":"B","city":"C"},"expectedTotal":1}'
        $r = Llamar "POST" "/api/orders" $variantTexto $t5 (Clave)
        Chk "T08 variantId como texto -> 400" ($r.Status -eq 400) "estado $($r.Status)"
        $grande = '{"pad":"' + ("x" * 20000) + '"}'
        $r09 = Llamar "POST" "/api/orders" $grande $t5 (Clave)
        Chk "T09 cuerpo de más de 16 KB -> 413" ($r09.Status -eq 413) "estado $($r09.Status)"
        Chk "T10 respuestas de error con Cache-Control no-store" ($r02.NoStore -and $r09.NoStore)

        "`n--- Flujo normal (usuario 1) ---"
        $ref2 = CartRef $vA 2
        $r = Llamar "POST" "/api/orders" (Cuerpo $vA 2 "transferencia" 1) $t1 (Clave)
        $totalReal = [decimal]$r.Json.details.total
        $envio = $totalReal - $ref2.Subtotal
        Chk "T11a total equivocado -> 409 precio_cambiado" ($r.Status -eq 409 -and $r.Json.code -eq "precio_cambiado" -and $envio -ge 0) "estado $($r.Status)"
        Chk "T11b no se tocó stock ni se creó pedido" ((Stock $vA) -eq 50 -and (Contar $e1) -eq 0)
        "      envío que calcula el servidor: $envio DOP (debe ser igual a tu Shipping:FixedCost)"

        $k1 = Clave
        $extra = @{ unitPrice = 1; total = 1; shipping = 0; currency = "USD"; status = "Confirmado"; userId = "otro-usuario" }
        $cuerpo1 = Cuerpo $vA 2 "transferencia" $totalReal $null $extra
        $r = Llamar "POST" "/api/orders" $cuerpo1 $t1 $k1
        $o = $r.Json
        $okPedido = ($r.Status -eq 201 -and $o.status -eq "Pendiente" -and $o.currency -eq "DOP" -and [decimal]$o.total -eq $totalReal -and [decimal]$o.subtotal -eq $ref2.Subtotal -and ([decimal]$o.subtotal + [decimal]$o.shipping) -eq [decimal]$o.total)
        Chk "T12a pedido válido -> 201, Pendiente, DOP, total del servidor (ignora precios y estado falsos)" $okPedido "estado $($r.Status)  cuerpo: $($r.Body)"
        Chk "T12b número DS-XXXXXXXX y referencia de pago igual al número" (($o.orderNumber -cmatch '^DS-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$') -and ($o.bankTransfer.paymentReference -eq $o.orderNumber))
        Chk "T12c línea con el precio del catálogo y el nombre copiado" ($o.lines.Count -eq 1 -and [decimal]$o.lines[0].unitPrice -eq $ref2.Unit -and $o.lines[0].quantity -eq 2 -and [bool]$o.lines[0].productName)
        Chk "T12d stock descontado (50 -> 48)" ((Stock $vA) -eq 48)
        Chk "T12e Cache-Control no-store y fecha en UTC (termina en Z)" ($r.NoStore -and ($r.Body -cmatch '"date":"[^"]*Z"'))

        $r = Llamar "POST" "/api/orders" $cuerpo1 $t1 $k1
        Chk "T13 misma clave y mismo contenido -> 200, mismo pedido, sin descontar de nuevo" ($r.Status -eq 200 -and $r.Json.id -eq $o.id -and (Stock $vA) -eq 48 -and (Contar $e1) -eq 1) "estado $($r.Status)"
        $r = Llamar "POST" "/api/orders" (Cuerpo $vA 2 "transferencia" $totalReal "otra nota" $extra) $t1 $k1
        Chk "T14 misma clave con otro contenido -> 409 clave_reutilizada" ($r.Status -eq 409 -and $r.Json.code -eq "clave_reutilizada") "estado $($r.Status)"
        $r = Llamar "POST" "/api/orders" (Cuerpo $vC 3 "transferencia" 1) $t1 (Clave)
        $estC = @($r.Json.details | Where-Object { $_.variantId -eq $vC })[0].status
        Chk "T15 stock insuficiente -> 409 stock_o_disponibilidad (stock_insuficiente), sin cambios" ($r.Status -eq 409 -and $r.Json.code -eq "stock_o_disponibilidad" -and $estC -eq "stock_insuficiente" -and (Stock $vC) -eq 2) "estado $($r.Status)"
        $r = Llamar "POST" "/api/orders" (Cuerpo $vD 1 "transferencia" 1) $t1 (Clave)
        $estD = @($r.Json.details | Where-Object { $_.variantId -eq $vD })[0].status
        Chk "T16 sin stock -> 409 stock_o_disponibilidad (sin_stock)" ($r.Status -eq 409 -and $estD -eq "sin_stock") "estado $($r.Status)"
        $r = Llamar "POST" "/api/orders" (Cuerpo 2147483647 1 "transferencia" 1) $t1 (Clave)
        $estX = @($r.Json.details)[0].status
        Chk "T17 variante inexistente -> 409 (no_disponible)" ($r.Status -eq 409 -and $estX -eq "no_disponible") "estado $($r.Status)"

        "`n--- Doble clic: 5 peticiones simultáneas con la misma clave (usuario 6) ---"
        $ref1 = CartRef $vA 1
        $total1 = $ref1.Subtotal + $envio
        $sA = Stock $vA
        $k2 = Clave
        $c2 = Cuerpo $vA 1 "contra_entrega" $total1
        $res = @(Paralelo @(1..5 | ForEach-Object { @{ Token = $t6; Key = $k2; Json = $c2 } }))
        "      códigos: " + (($res | ForEach-Object { $_.Status } | Sort-Object) -join ", ")
        $creados = @($res | Where-Object { $_.Status -eq 201 })
        $repetidos = @($res | Where-Object { $_.Status -eq 200 })
        $idsUnicos = @($res | ForEach-Object { $_.Json.id } | Where-Object { $_ } | Select-Object -Unique)
        Chk "T18a un solo 201 y cuatro 200 con el mismo pedido" ($creados.Count -eq 1 -and $repetidos.Count -eq 4 -and $idsUnicos.Count -eq 1)
        Chk "T18b un solo pedido y stock descontado una sola vez" ((Contar $e6) -eq 1 -and (Stock $vA) -eq ($sA - 1))
        Chk "T18c contra entrega: la respuesta no incluye datos bancarios" ($creados.Count -eq 1 -and $null -eq $creados[0].Json.bankTransfer)

        "`n--- Tope de pendientes: 6 peticiones simultáneas con claves distintas (usuario 4) ---"
        $sA = Stock $vA
        $c4 = Cuerpo $vA 1 "transferencia" $total1
        $res = @(Paralelo @(1..6 | ForEach-Object { @{ Token = $t4; Key = (Clave); Json = $c4 } }))
        "      códigos: " + (($res | ForEach-Object { $_.Status } | Sort-Object) -join ", ")
        $creados = @($res | Where-Object { $_.Status -eq 201 })
        $rechazados = @($res | Where-Object { $_.Status -eq 409 -and ($_.Json.code -eq "demasiados_pendientes" -or $_.Json.code -eq "reintentar") })
        Chk "T19a exactamente 3 pedidos creados y 3 rechazados con 409" ($creados.Count -eq 3 -and $rechazados.Count -eq 3)
        Chk "T19b en la base hay 3 pendientes y el stock bajó exactamente 3" ((Contar $e4 "AND o.Status = 'Pendiente'") -eq 3 -and (Stock $vA) -eq ($sA - 3))

        "`n--- El último artículo: dos usuarios a la vez (usuarios 2 y 3) ---"
        $refB = CartRef $vB 1
        $cb = Cuerpo $vB 1 "transferencia" ($refB.Subtotal + $envio)
        $res = @(Paralelo @(@{ Token = $t2; Key = (Clave); Json = $cb }, @{ Token = $t3; Key = (Clave); Json = $cb }))
        "      códigos: " + (($res | ForEach-Object { $_.Status } | Sort-Object) -join ", ")
        $creados = @($res | Where-Object { $_.Status -eq 201 })
        $perdedor = @($res | Where-Object { $_.Status -eq 409 -and $_.Json.code -eq "stock_o_disponibilidad" })
        Chk "T20a solo uno compra el último artículo y el otro recibe 409" ($creados.Count -eq 1 -and $perdedor.Count -eq 1)
        Chk "T20b el stock queda en 0, nunca negativo" ((Stock $vB) -eq 0)

        "`n--- Límite de login (regresión del orden del limitador) ---"
        $lj = '{"email":"no-existe@example.com","password":"ClaveEquivocada999"}'
        $ultimo = $null
        $cods = foreach ($i in 1..12) { $ultimo = Llamar "POST" "/api/auth/login" $lj; $ultimo.Status }
        "      códigos: " + ($cods -join ", ")
        Chk "T21a login: 10 veces 401 y luego 429" (@($cods | Select-Object -First 10 | Where-Object { $_ -eq 401 }).Count -eq 10 -and @($cods | Select-Object -Skip 10 | Where-Object { $_ -eq 429 }).Count -eq 2)
        Chk "T21b la respuesta 429 lleva no-store" ($ultimo.Status -eq 429 -and $ultimo.NoStore)

        "`nRESUMEN: $($global:pasan) pasan, $($global:fallan) fallan"
    }
    finally {
        "`nLimpieza..."
        foreach ($v in $orig) { Sql "UPDATE ProductVariants SET Stock = $($v.Stock) WHERE Id = $($v.Id)" | Out-Null }
        Sql "DELETE FROM Orders WHERE UserId IN (SELECT Id FROM AspNetUsers WHERE Email LIKE 'ordtest%@example.com')" | Out-Null
        "Stock restaurado: " + (($orig | ForEach-Object { "$($_.Id)=" + (Stock $_.Id) }) -join "  ")
        "Pedidos de prueba que quedan: " + (Sql "SELECT COUNT(*) FROM Orders o JOIN AspNetUsers u ON u.Id = o.UserId WHERE u.Email LIKE 'ordtest%@example.com'" | Select-Object -First 1)
    }
}
