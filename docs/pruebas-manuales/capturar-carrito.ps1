function Capturar($dir) {
    $base = "http://localhost:5008"
    New-Item -ItemType Directory -Force $dir | Out-Null
    Get-ChildItem $dir -File -ErrorAction SilentlyContinue | Remove-Item -Force

    function Post-Cart($json) {
        $tmp = Join-Path $env:TEMP "ds-cart.json"
        [System.IO.File]::WriteAllText($tmp, $json)
        $out = @(& curl.exe -s -w "`n%{http_code}" -X POST "$base/api/cart/validate" -H "Content-Type: application/json" --data-binary "@$tmp")
        $status = $out[-1]
        $body = if ($out.Count -ge 2) { ($out[0..($out.Count - 2)] -join "`n") } else { "" }
        return "HTTP $status`n$body"
    }
    function Linea($id, $q) { @{ variantId = $id; quantity = $q } }

    $p = Invoke-RestMethod -Uri "$base/api/products"
    $lista = $null
    foreach ($n in "items","products","data","results") { if ($p.$n) { $lista = $p.$n; break } }
    if (-not $lista) { $lista = $p }
    $ids = New-Object System.Collections.Generic.List[object]
    foreach ($prod in (@($lista) | Select-Object -First 12)) {
        if (-not $prod.slug) { continue }
        $d = Invoke-RestMethod -Uri "$base/api/products/$($prod.slug)"
        foreach ($v in @($d.variants)) {
            $vid = $null
            foreach ($n in "variantId","id") { if ($v.$n) { $vid = $v.$n; break } }
            if ($vid) { $ids.Add($vid) }
        }
    }
    "Variantes encontradas: $($ids.Count)"
    if ($ids.Count -lt 3) { "Necesito al menos 3. Pégame los nombres de propiedades de /api/products/<slug>."; return }

    $casos = [ordered]@{
        "01-valido"          = ConvertTo-Json -InputObject @(Linea $ids[0] 1) -Compress
        "02-cantidad-10"     = ConvertTo-Json -InputObject @(Linea $ids[0] 10) -Compress
        "03-tres-variantes"  = ConvertTo-Json -InputObject @((Linea $ids[0] 10), (Linea $ids[1] 10), (Linea $ids[2] 10)) -Compress
        "04-repetida"        = ConvertTo-Json -InputObject @((Linea $ids[0] 1), (Linea $ids[0] 2)) -Compress
        "05-inexistente"     = ConvertTo-Json -InputObject @(Linea 2147483647 1) -Compress
        "06-mezcla"          = ConvertTo-Json -InputObject @((Linea $ids[0] 1), (Linea 2147483647 1)) -Compress
        "07-vacio"           = "[]"
        "08-cantidad-0"      = ConvertTo-Json -InputObject @(Linea $ids[0] 0) -Compress
        "09-cantidad-11"     = ConvertTo-Json -InputObject @(Linea $ids[0] 11) -Compress
        "10-21-lineas"       = ConvertTo-Json -InputObject @(1..21 | ForEach-Object { Linea $ids[0] 1 }) -Compress
        "11-cuerpo-invalido" = '{"x":1}'
    }
    foreach ($c in $casos.GetEnumerator()) {
        Set-Content -Path (Join-Path $dir "$($c.Key).txt") -Value (Post-Cart $c.Value) -Encoding UTF8
    }

    "`nCódigos HTTP por caso:"
    Get-ChildItem $dir -File | ForEach-Object { "{0,-22} {1}" -f $_.BaseName, (Get-Content $_.FullName -TotalCount 1) }
    "`nEstados vistos en las respuestas:"
    $todo = (Get-ChildItem $dir -File | ForEach-Object { Get-Content -Raw $_.FullName }) -join "`n"
    foreach ($e in "ok","stock_insuficiente","sin_stock","no_disponible") {
        "{0,-20} {1}" -f $e, ([regex]::Matches($todo, '"' + $e + '"')).Count
    }
}
