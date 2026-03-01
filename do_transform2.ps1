$fp='d:\HobbyProjects\collm\apps\web\app\nodes\[id]\page.tsx'
$c=[System.IO.File]::ReadAllText($fp)
$ok=@();$fail=@()
function rep($num,$s,$r){if($c.Contains($s)){$script:c=$c.Replace($s,$r);$script:ok+=$num}else{$script:fail+=$num;Write-Host 'FAIL:' $num}}
$s2=@'
  const [userVotes, setUserVotes] = useState<Record<string, number>>({});
'@
$r2=@'
  const [userVotes, setUserVotes] = useState<Record<string, number>>({});
  const [showMilestones, setShowMilestones] = useState(false);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [pendingContribs, setPendingContribs] = useState<any[]>([]);
  const [relatedNodes, setRelatedNodes] = useState<any[]>([]);
  const [viewers, setViewers] = useState<string[]>([]);
  const [deferContrib, setDeferContrib] = useState(false);
'@
rep 2 $s2 $r2
$s3=@'
      // The core service returns the node at the top level (not nested)
      setNode(data);
    } catch {
      setLoadError('Could not load this topic. Is the core-service running?');
    }
'@
$r3=@'
      // The core service returns the node at the top level (not nested)
      setNode(data);
      // Fetch related nodes
      try {
        const relRes = await fetch(`/api/nodes/${nodeId}/related`);
        if (relRes.ok) { const relData = await relRes.json(); setRelatedNodes(relData.related ?? relData ?? []); }
      } catch { /* non-fatal */ }
    } catch {
      setLoadError('Could not load this topic. Is the core-service running?');
    }
'@
rep 3 $s3 $r3
$s4=@'
      setContributions(userContribs);
    } catch {
      // non-fatal
    }
  }, [nodeId]);
'@
$r4=@'
      setContributions(userContribs);
      // Load pending contributions
      try {
        const pRes = await fetch(`/api/nodes/${nodeId}/pending`);
        if (pRes.ok) { const pData = await pRes.json(); setPendingContribs(pData.pending ?? pData ?? []); }
      } catch { /* non-fatal */ }
      // Load milestones
      try {
        const mRes = await fetch(`/api/nodes/${nodeId}/milestones`);
        if (mRes.ok) { const mData = await mRes.json(); setMilestones(mData.milestones ?? mData ?? []); }
      } catch { /* non-fatal */ }
    } catch {
      // non-fatal
    }
  }, [nodeId]);
'@
rep 4 $s4 $r4
$s5=@'
  }, [nodeId, loadNode, loadContributions, router]);

  // Open contribute panel
'@
$r5=@'
  }, [nodeId, loadNode, loadContributions, router]);

  // Presence polling: POST every 15s
  useEffect(() => {
    if (!userId || userId === 'anonymous') return;
    const postPresence = async () => {
      try {
        const res = await fetch(`/api/nodes/${nodeId}/presence`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        });
        if (res.ok) { const d = await res.json(); setViewers((d.viewers ?? []).filter((v: string) => v !== userId)); }
      } catch { /* non-fatal */ }
    };
    postPresence();
    const presenceInterval = setInterval(postPresence, 15_000);
    return () => clearInterval(presenceInterval);
  }, [nodeId, userId]);

  // Open contribute panel
'@
rep 5 $s5 $r5
$s6=@'
          contribution: text,
          userId,
          userName: displayName,
          sourceUrl: sourceUrl.trim() || undefined,
        }),
'@
$r6=@'
          contribution: text,
          userId,
          userName: displayName,
          sourceUrl: sourceUrl.trim() || undefined,
          defer: deferContrib,
        }),
'@
rep 6 $s6 $r6
$s7=@'
                className="w-full border rounded-xl px-4 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 placeholder:text-gray-400"
              />
'@
$r7=@'
                className="w-full border rounded-xl px-4 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 placeholder:text-gray-400"
              />

              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deferContrib}
                  onChange={e => setDeferContrib(e.target.checked)}
                  disabled={evolving}
                  className="rounded"
                />
                Defer (add to moderation queue)
              </label>
'@
rep 7 $s7 $r7
$s8=@'
            <button onClick={openPanel} className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
'@
$r8=@'
            {viewers.length > 0 && (
              <div className="flex items-center gap-1 mr-1">
                {viewers.slice(0, 5).map((v, i) => (
                  <div key={i} title={v} className="w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `hsl(${v.charCodeAt(0) * 37 % 360}, 60%, 50%)` }}>
                    {v[0]?.toUpperCase()}
                  </div>
                ))}
              </div>
            )}
            {node?.nodeState && (
              <button onClick={() => { const n = window.prompt('Milestone name'); if (n) { fetch(`/api/nodes/${nodeId}/milestones`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: n }) }).then(r => r.ok && loadContributions()); } }} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors hidden sm:block">
                Save milestone
              </button>
            )}
            <button onClick={() => setShowMilestones(v => !v)} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors hidden sm:block">
              Milestones
            </button>
            <button onClick={openPanel} className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
'@
rep 8 $s8 $r8
$s9=@'
function ContributionListItem({ c, afterState, onOpen }: { c: Contribution; afterState?: string; onOpen: () => void }) {
'@
$r9=@'
function ContributionListItem({ c, afterState, onOpen, contested }: { c: Contribution; afterState?: string; onOpen: () => void; contested?: boolean }) {
'@
rep 9 $s9 $r9
$s10=@'
          )}
        </div>
        <p
          ref={contentRef}
'@
$r10=@'
          )}
          {contested && <span className="text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 bg-orange-100 text-orange-700"> Disputed</span>}
        </div>
        <p
          ref={contentRef}
'@
rep 10 $s10 $r10
[System.IO.File]::WriteAllText($fp,$c)
Write-Host 'OK:' ($ok -join ',')
Write-Host 'FAIL:' ($fail -join ',')
Write-Host 'Length:' $c.Length
