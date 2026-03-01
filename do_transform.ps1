$fp='d:\HobbyProjects\collm\apps\web\app\nodes\[id]\page.tsx'
$c=[System.IO.File]::ReadAllText($fp)
$ok=@();$fail=@()
function rep($num,$s,$r){if($c.Contains($s)){$script:c=$c.Replace($s,$r);$script:ok+=$num}else{$script:fail+=$num;Write-Host 'FAIL:' $num}}
$s1=@'
// ---------------------------------------------------------------------------
// Expandable contribution list item (4 lines at a time)
// ---------------------------------------------------------------------------
'@
$r1=@'
function detectContested(contributions: Contribution[]): Set<string> {
  const contested = new Set<string>();
  const addedLines: Map<string, Set<string>> = new Map();
  for (let i = 0; i < contributions.length; i++) {
    const c = contributions[i];
    const before = c.nodeStateBefore ?? '';
    const nextC = contributions[i + 1];
    if (!nextC) continue;
    const after = nextC.nodeStateBefore ?? '';
    const changes = diffLines(before, after);
    const added = new Set(changes.filter(c => c.added).map(c => c.value.trim()).filter(Boolean));
    addedLines.set(c.id, added);
  }
  for (const [id, added] of addedLines.entries()) {
    if (added.size === 0) continue;
    const idxA = contributions.findIndex(c => c.id === id);
    for (let j = idxA + 1; j < contributions.length; j++) {
      const laterC = contributions[j];
      const laterBefore = laterC.nodeStateBefore ?? '';
      const laterNext = contributions[j + 1];
      if (!laterNext) continue;
      const laterAfter = laterNext.nodeStateBefore ?? '';
      const laterChanges = diffLines(laterBefore, laterAfter);
      const laterRemoved = new Set(laterChanges.filter(c => c.removed).map(c => c.value.trim()).filter(Boolean));
      const overlap = [...added].filter(line => laterRemoved.has(line)).length;
      if (overlap > 0 && overlap / added.size >= 0.3) {
        contested.add(id);
        contested.add(laterC.id);
      }
    }
  }
  return contested;
}

// ---------------------------------------------------------------------------
// Expandable contribution list item (4 lines at a time)
// ---------------------------------------------------------------------------
'@
rep 1 $s1 $r1
[System.IO.File]::WriteAllText($fp,$c)
Write-Host 'Steps OK:' ($ok -join ',')
Write-Host 'Steps FAIL:' ($fail -join ',')
Write-Host 'Final length:' $c.Length
