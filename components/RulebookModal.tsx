import React from 'react';

interface RuleSection {
  icon: string;
  title: string;
  accent: string;
  summary: string;
  points: string[];
}

interface RulebookModalProps {
  onClose: () => void;
}

const sections: RuleSection[] = [
  {
    icon: '01',
    title: 'Match Objective',
    accent: 'from-red-400/20 to-orange-400/10 border-red-400/30 text-red-100',
    summary: 'A standard match ends the moment one player has no units left on the battlefield.',
    points: [
      'Every controlled battlefield piece counts as a unit for defeat checks, including the MAIN.',
      'The match does not wait for cards in hand, pending deliveries, or future reinforcements.',
      'Destroying the enemy MAIN is often decisive because it is both a unit and the anchor for deployment.'
    ]
  },
  {
    icon: '02',
    title: 'Turn Sequence',
    accent: 'from-cyan-400/20 to-sky-400/10 border-cyan-400/30 text-cyan-100',
    summary: 'Play alternates between Player 1 and Player 2. After Player 2 finishes, neutral creeps act and the round advances.',
    points: [
      'At the end of the active player turn, that side resolves auto-attacks, effect timers, structure support, and passive regeneration.',
      'After Player 2 ends the turn, the neutral phase runs before the next round begins.',
      'When a new player turn starts, that player units refresh their movement and attack allowances.'
    ]
  },
  {
    icon: '03',
    title: 'Movement',
    accent: 'from-emerald-400/20 to-lime-400/10 border-emerald-400/30 text-emerald-100',
    summary: 'Movement is step-based. A unit may move multiple times in one turn, as long as its total steps do not exceed its movement stat.',
    points: [
      'Movement uses tile-by-tile paths and cannot pass through occupied, missing, or invalid terrain.',
      'Standard movement currently follows orthogonal step paths rather than free diagonal travel.',
      'A unit may stop, attack, and still use any remaining movement later in the same turn if it still has steps left.'
    ]
  },
  {
    icon: '04',
    title: 'Attacking',
    accent: 'from-fuchsia-400/20 to-pink-400/10 border-fuchsia-400/30 text-fuchsia-100',
    summary: 'Attacks consume attack charges, not movement. If a unit still has attacks available, it may keep fighting during that turn.',
    points: [
      'An attack must satisfy range and line-of-sight requirements.',
      'Invulnerable targets can be targeted, but the attack is deflected and deals no damage.',
      'A unit can normally attack only up to its attack allowance for that turn, but units with higher attack allowances may strike more than once.',
      'Attacking does not automatically end movement, so move-attack-move sequences are legal when steps remain.'
    ]
  },
  {
    icon: '05',
    title: 'Auto-Attack Lock',
    accent: 'from-amber-400/20 to-yellow-400/10 border-amber-400/30 text-amber-100',
    summary: 'When a unit attacks an enemy player-controlled target, it stores that target as an auto-attack lock.',
    points: [
      'At the end of its owner turn, the unit keeps firing while the lock is still valid and it still has unused attacks for that turn.',
      'The lock breaks if the target dies, leaves line of sight, moves out of range, or is otherwise no longer a valid target.',
      'Because attack charges refresh on the owner next turn, surviving locks can continue to matter across later turns as well.'
    ]
  },
  {
    icon: '06',
    title: 'Energy and Abilities',
    accent: 'from-violet-400/20 to-indigo-400/10 border-violet-400/30 text-violet-100',
    summary: 'Units with an energy pool enter play at half energy and recover energy over time.',
    points: [
      'Newly deployed units spawn with half of their maximum energy, rounded down.',
      'All units with energy regenerate 5 energy at the end of their own turns, up to their cap.',
      'Additional support effects and structures can restore more energy, but they still cannot exceed max energy.',
      'A frozen unit cannot move or attack until the disabling effect expires.'
    ]
  },
  {
    icon: '07',
    title: 'Deployment and Landing Zones',
    accent: 'from-green-400/20 to-teal-400/10 border-green-400/30 text-green-100',
    summary: 'Unit cards deploy onto your active landing-zone tiles. If your MAIN falls, your landing grid collapses.',
    points: [
      'Standard unit deployment requires free tiles inside your own landing zone.',
      'A destroyed MAIN removes all landing-zone tiles belonging to that player.',
      'Once your landing zones are gone, you cannot deploy new units until a rule or action creates fresh deployment space.'
    ]
  },
  {
    icon: '08',
    title: 'Cards and Inventory',
    accent: 'from-blue-400/20 to-cyan-400/10 border-blue-400/30 text-blue-100',
    summary: 'The game uses two card families: unit cards and action cards.',
    points: [
      'Unit cards place new units onto the map when deployed legally.',
      'Action cards either resolve immediately or enter a targeting mode before they resolve.',
      'Inventory capacity is limited. Pending deliveries also reserve inventory space, not just cards already in hand.'
    ]
  },
  {
    icon: '09',
    title: 'Shop and Logistics',
    accent: 'from-slate-300/20 to-slate-500/10 border-slate-300/30 text-slate-100',
    summary: 'Each player starts with 500 credits and uses the shop to buy reinforcements or tactical actions.',
    points: [
      'There is no passive credit income per turn in the current ruleset.',
      'Shop orders usually take 1 to 3 rounds to arrive, with rare instant deliveries.',
      'At rounds 10, 25, and 50 the shop restocks and both players receive a 500-credit supply injection.',
      'After round 100, the shop goes offline and no further supply restocks occur.'
    ]
  },
  {
    icon: '10',
    title: 'Neutral Creeps',
    accent: 'from-zinc-300/20 to-zinc-500/10 border-zinc-300/30 text-zinc-100',
    summary: 'Neutral creeps are non-player units placed by the map. They act automatically during the neutral phase.',
    points: [
      'Neutral units attack the closest eligible non-neutral target they can legally hit.',
      'They ignore other neutral units when selecting enemies.',
      'Some neutral creeps can use additional scripted behavior beyond a basic attack when their conditions are met.'
    ]
  }
];

const RulebookModal: React.FC<RulebookModalProps> = ({ onClose }) => {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/65 px-4 py-6 backdrop-blur-sm">
      <div className="relative flex h-full max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-cyan-400/30 bg-[#060b10]/95 shadow-[0_0_60px_rgba(34,211,238,0.15)]">
        <div
          className="pointer-events-none absolute inset-0 opacity-15"
          style={{
            backgroundImage:
              'linear-gradient(rgba(34,211,238,0.25) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.25) 1px, transparent 1px)',
            backgroundSize: '28px 28px'
          }}
        />

        <div className="relative z-10 flex items-start justify-between gap-4 border-b border-cyan-400/20 px-6 py-5 md:px-8">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.42em] text-cyan-300/70">Rulebook</div>
            <h2 className="mt-2 text-3xl font-black uppercase tracking-[0.16em] text-white md:text-4xl">
              Combat Protocol
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              This manual describes the live rules of play: turn flow, movement, attacks, energy, deployment,
              logistics, neutral behavior, and match resolution. It intentionally omits unit-by-unit stat detail.
            </p>
          </div>

          <button
            onClick={onClose}
            className="shrink-0 rounded-xl border border-cyan-400/40 bg-cyan-500/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.28em] text-cyan-100 transition-colors hover:border-cyan-300 hover:bg-cyan-400/15 hover:text-white"
          >
            Close [Esc]
          </button>
        </div>

        <div className="relative z-10 overflow-y-auto px-6 py-6 md:px-8">
          <div className="mb-6 grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 md:grid-cols-3">
            <div className="rounded-2xl border border-red-400/20 bg-red-500/5 p-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-red-200/80">Victory</div>
              <div className="mt-2 text-sm leading-6 text-slate-200">
                Eliminate every enemy battlefield unit. If a player controls zero units, that player loses immediately.
              </div>
            </div>
            <div className="rounded-2xl border border-green-400/20 bg-green-500/5 p-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-green-200/80">Deployment</div>
              <div className="mt-2 text-sm leading-6 text-slate-200">
                Units enter through active landing zones. MAIN destruction shuts that grid down.
              </div>
            </div>
            <div className="rounded-2xl border border-violet-400/20 bg-violet-500/5 p-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-violet-200/80">Energy</div>
              <div className="mt-2 text-sm leading-6 text-slate-200">
                Energy units spawn at half charge and recover 5 energy at the end of their own turns.
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {sections.map((section) => (
              <section
                key={section.title}
                className={`rounded-2xl border bg-gradient-to-br p-5 ${section.accent}`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-black/25 text-sm font-black uppercase tracking-[0.18em] text-white">
                    {section.icon}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-black uppercase tracking-[0.16em] text-white">
                      {section.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-200">
                      {section.summary}
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {section.points.map((point) => (
                    <div key={point} className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/15 px-3 py-3 text-sm leading-6 text-slate-100">
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-current opacity-80" />
                      <span>{point}</span>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RulebookModal;
