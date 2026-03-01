fp = r"d:\HobbyProjects\collm\apps\web\app\nodes\[id]\page.tsx"
with open(fp, "r", encoding="utf-8") as f: c = f.read()
ok=[]; fail=[]
def rep(n,s,r):
    global c
    if s in c: c=c.replace(s,r,1); ok.append(n)
    else: fail.append(n); print("FAIL step",n)

# Step 8: Header viewer avatars + milestone buttons
s8 = """
            <button onClick={openPanel} className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
"""
r8 = """
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
"""
rep(8, s8, r8)

# Step 9: Add contested prop
s9 = """function ContributionListItem({ c, afterState, onOpen }: { c: Contribution; afterState?: string; onOpen: () => void }) {"""
r9 = """function ContributionListItem({ c, afterState, onOpen, contested }: { c: Contribution; afterState?: string; onOpen: () => void; contested?: boolean }) {"""
rep(9, s9, r9)

# Step 10: Disputed badge in ContributionListItem
s10 = """
          )}
        </div>
        <p
          ref={contentRef}
"""
r10 = """
          )}
          {contested && <span className="text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 bg-orange-100 text-orange-700"> Disputed</span>}
        </div>
        <p
          ref={contentRef}
"""
rep(10, s10, r10)

# Step 11: Add Pending Queue + update ContributionListItem with contested prop
s11 = """
            {/* List */}
            {(() => {
              const q = searchQuery.trim().toLowerCase();
"""
r11 = """
            {/* Pending Queue */}
            {pendingContribs.length > 0 && (
              <div className="border-b px-4 py-3 bg-amber-50">
                <h3 className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Pending Queue</h3>
                <ul className="space-y-2">
                  {pendingContribs.map((pc: any) => (
                    <li key={pc.id} className="flex items-center justify-between gap-2 text-xs text-amber-900">
                      <span className="truncate">{pc.userId}: {pc.content?.slice(0, 40)}...</span>
                      <button onClick={() => fetch(`/api/nodes/${nodeId}/pending/synthesize`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: pc.id }) }).then(() => loadContributions())} className="flex-shrink-0 text-xs bg-amber-600 text-white px-2 py-0.5 rounded hover:bg-amber-700">
                        Synthesize now
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {/* List */}
            {(() => {
              const q = searchQuery.trim().toLowerCase();
"""
rep(11, s11, r11)


# Step 12: Add contestedSet and update ContributionListItem call
s12 = """
              return (
                <ul className="flex-1 overflow-y-auto divide-y">
                  {filtered.map(c => {
                    const chronIdx = contributions.findIndex(x => x.id === c.id);
"""
r12 = """
              const contestedSet = detectContested(contributions);
              return (
                <ul className="flex-1 overflow-y-auto divide-y">
                  {filtered.map(c => {
                    const chronIdx = contributions.findIndex(x => x.id === c.id);
"""
rep(12, s12, r12)

# Step 13: Add contested prop to ContributionListItem JSX call
s13 = """
                        onOpen={() => { setSelectedContribution(c); setShowHistory(false); }}
                      />
"""
r13 = """
                        onOpen={() => { setSelectedContribution(c); setShowHistory(false); }}
                        contested={contestedSet.has(c.id)}
                      />
"""
rep(13, s13, r13)



# Step 14
s14 = """      {selectedContribution && node && (() => {"""
r14 = """
      {showMilestones && (
        <>
          <div className="fixed inset-0 bg-black/20 z-30" onClick={() => setShowMilestones(false)} />
          <aside className="fixed top-0 right-0 h-full w-80 bg-white border-l shadow-2xl z-40 flex flex-col">
            <div className="flex-shrink-0 border-b px-4 py-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800">Milestones</h2>
              <button onClick={() => setShowMilestones(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none" aria-label="Close">×</button>
            </div>
            <ul className="flex-1 overflow-y-auto divide-y">
              {milestones.length === 0 && <li className="px-4 py-6 text-xs text-gray-400 text-center">No milestones yet.</li>}
              {milestones.map((m: any) => (
                <li key={m.id} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm text-gray-800">{m.name}</span>
                    <button onClick={() => fetch(`/api/nodes/${nodeId}/milestones/${m.id}/restore`, { method: "POST" }).then(r => r.ok && r.json()).then(d => d && setNode(prev => prev ? { ...prev, nodeState: d.nodeState, version: d.version } : prev))} className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded hover:bg-indigo-700">
                      Restore
                    </button>
                  </div>
                  <div className="text-xs text-gray-400">
                    <span>v{m.version}</span> <span>{m.createdAt ? new Date(m.createdAt).toLocaleDateString() : ""}</span>
                  </div>
                </li>
              ))}
            </ul>
          </aside>
        </>
      )}

      {selectedContribution && node && (() => {
"""
rep(14, s14, r14)


# Step 15: Related Topics section
s15 = """
            </div>
          </>
        )}

      </main>
"""
r15 = """
            </div>
          </>
        )}

        {/* Related Topics */}
        {relatedNodes.length > 0 && (
          <div className="mt-10 pt-6 border-t border-gray-100">
            <h2 className="text-sm font-semibold text-gray-600 mb-3">Related Topics</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {relatedNodes.slice(0, 5).map((rn: any) => (
                <a key={rn.id} href={`/nodes/${rn.id}`} className="block p-3 border border-gray-200 rounded-lg hover:bg-indigo-50 hover:border-indigo-200 transition-colors">
                  <p className="font-medium text-sm text-gray-800 truncate">{rn.topic}</p>
                  {typeof rn.similarity === "number" && (
                    <p className="text-xs text-indigo-500 mt-0.5">
                      {Math.round(rn.similarity * 100)}% match
                    </p>
                  )}
                </a>
              ))}
            </div>
          </div>
        )}

      </main>
"""
rep(15, s15, r15)

with open(fp, "w", encoding="utf-8") as f: f.write(c)
print("OK:", ok)
print("FAIL:", fail)
