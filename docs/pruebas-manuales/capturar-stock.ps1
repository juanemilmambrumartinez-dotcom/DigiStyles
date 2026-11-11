function Capturar-Stock($dir) {
    $ErrorActionPreference = 'Stop'
    $base = "http://localhost:5008"
    $srv = "localhost"
    $db = "DigiStylesDev"
    $respaldo = "C:\Temp\stock-original.csv"
    New-Item -ItemType Directory -Force $dir | Out-Null

    function Sql($q) { & sqlcmd -S $srv -E -d $db -h -1 -W -Q "SET NOCOUNT ON; $q" }
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
    if ($ids.Count -lt 3) { "Necesito al menos 3 variantes. No se cambió nada."; return }
    $a = $ids[0]; $b = $ids[1]; $c = $ids[2]
    "Variantes de prueba: $a (sin stock), $b (stock 3), $c (sin tocar)"

    $orig = @{}
    foreach ($id in @($a, $b)) {
        $v = Sql "SELECT Stock FROM ProductVariants WHERE Id = $id" | Select-Object -First 1
        if ($v -notmatch '^\d+$') { "No pude leer el stock de la variante $id. No se cambió nada."; return }
        $orig[$id] = [int]$v
    }
    if ($orig.Count -ne 2) { 'No se leyeron los dos valores originales. No se cambió nada.'; return }
    $orig.GetEnumerator() | ForEach-Object { "$($_.Key),$($_.Value)" } | Set-Content $respaldo -Encoding ASCII
    "Stock original guardado en ${respaldo}: " + (($orig.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join "  ")

    try {
        Sql "UPDATE ProductVariants SET Stock = 0 WHERE Id = $a" | Out-Null
        Sql "UPDATE ProductVariants SET Stock = 3 WHERE Id = $b" | Out-Null
        $casos = [ordered]@{
            "12-sin-stock"           = ConvertTo-Json -InputObject @(Linea $a 1) -Compress
            "13-stock-insuficiente"  = ConvertTo-Json -InputObject @(Linea $b 5) -Compress
            "14-stock-exacto"        = ConvertTo-Json -InputObject @(Linea $b 3) -Compress
            "15-mezcla-stock"        = ConvertTo-Json -InputObject @((Linea $a 1), (Linea $b 5), (Linea $c 1)) -Compress
            "16-repetida-suma-mas"   = ConvertTo-Json -InputObject @((Linea $b 2), (Linea $b 2)) -Compress
        }
        foreach ($k in $casos.GetEnumerator()) {
            Set-Content -Path (Join-Path $dir "$($k.Key).txt") -Value (Post-Cart $k.Value) -Encoding UTF8
        }
    } finally {
        foreach ($id in $orig.Keys) { Sql "UPDATE ProductVariants SET Stock = $($orig[$id]) WHERE Id = $id" | Out-Null }
        $verif = foreach ($id in $orig.Keys) { "$id=" + (Sql "SELECT Stock FROM ProductVariants WHERE Id = $id" | Select-Object -First 1) }
        "Stock restaurado: " + ($verif -join "  ")
    }

    "`nCódigos HTTP de los casos de stock:"
    Get-ChildItem $dir -File | Where-Object { $_.Name -match '^1[2-6]-' } | ForEach-Object { "{0,-24} {1}" -f $_.BaseName, (Get-Content $_.FullName -TotalCount 1) }
    "`nEstados vistos en esos casos:"
    $todo = (Get-ChildItem $dir -File | Where-Object { $_.Name -match '^1[2-6]-' } | ForEach-Object { Get-Content -Raw $_.FullName }) -join "`n"
    foreach ($e in "ok","stock_insuficiente","sin_stock","no_disponible") {
        "{0,-20} {1}" -f $e, ([regex]::Matches($todo, '"' + $e + '"')).Count
    }
}

