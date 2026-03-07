import React from 'react';

interface RuleSection {
  code: string;
  title: string;
  accent: string;
  bullets: string[];
}

interface RulebookModalProps {
  onClose: () => void;
}

const sections: RuleSection[] = [
  {
    code: '01',
    title: 'Match Formats',
    accent: 'from-cyan-400/20 to-sky-400/10 border-cyan-400/30 text-cyan-100',
    bullets: [
      'Duel: P1 vs P2. Turn order: P1 -> P2.',
      '3-player team: P1 + P2 vs P3. Turn order: P1 -> P2 -> P3.',
      '4-player team: P1 + P2 vs P3 + P4. Turn order: P1 -> P2 -> P3 -> P4.',
      'Free For All: every active player is hostile to every other active player.'
    ]
  },
  {
    code: '02',
    title: 'Win Condition',
    accent: 'from-red-400/20 to-orange-400/10 border-red-400/30 text-red-100',
    bullets: [
      'A player loses immediately when that player controls 0 battlefield units.',
      'The MAIN counts as a unit for defeat checks.',
      'In team modes, losing your own units is not enough to lose the match if your ally still controls units.',
      'The winning side is the last surviving player or allied side on the battlefield.'
    ]
  },
  {
    code: '03',
    title: 'Turn Structure',
    accent: 'from-sky-400/20 to-cyan-400/10 border-sky-400/30 text-sky-100',
    bullets: [
      'Only the active player may move, attack, deploy, or use cards unless an effect says otherwise.',
      'When a turn ends, that side resolves auto-attacks, effect timers, structure support, and passive turn-end effects.',
      'After the last player in turn order finishes, neutral creeps act, the round advances, and milestone systems may trigger.',
      'When a player turn begins, that player units refresh movement and attack allowances for the new turn.'
    ]
  },
  {
    code: '04',
    title: 'Movement',
    accent: 'from-emerald-400/20 to-lime-400/10 border-emerald-400/30 text-emerald-100',
    bullets: [
      'Movement is step-based. A unit may move multiple times in one turn until it spends its full movement stat.',
      'Movement uses orthogonal tile paths and must respect terrain, ramps, blockers, footprint size, and occupancy.',
      'A unit may move, attack, then continue moving later in the same turn if it still has steps remaining.',
      'Frozen units cannot move until the disabling effect expires.'
    ]
  },
  {
    code: '05',
    title: 'Combat',
    accent: 'from-fuchsia-400/20 to-pink-400/10 border-fuchsia-400/30 text-fuchsia-100',
    bullets: [
      'An attack must satisfy target relation, range, and line-of-sight rules.',
      'Attacks spend attack charges, not movement. Units with more than one attack allowance may strike multiple times in one turn.',
      'Attacking does not automatically end movement.',
      'Area damage is generally not team-safe. Blast effects can damage allies unless a specific rule says otherwise.'
    ]
  },
  {
    code: '06',
    title: 'Auto-Attack Lock',
    accent: 'from-amber-400/20 to-yellow-400/10 border-amber-400/30 text-amber-100',
    bullets: [
      'When a unit attacks a hostile player-controlled target, it stores that target as an auto-attack lock.',
      'At the end of its owner turn, the unit continues firing while the lock remains valid and it still has attacks left.',
      'The lock breaks if the target dies, leaves range, loses line of sight, or otherwise becomes invalid.'
    ]
  },
  {
    code: '07',
    title: 'Energy And Status',
    accent: 'from-violet-400/20 to-indigo-400/10 border-violet-400/30 text-violet-100',
    bullets: [
      'Units with energy enter play at half of maximum energy, rounded down.',
      'All units with energy regenerate 5 energy at the end of their own turns, up to their cap.',
      'Support abilities and structures may restore additional energy, but never above maximum.',
      'Invulnerable targets can still be targeted, but incoming damage is deflected.'
    ]
  },
  {
    code: '08',
    title: 'Deployment And MAIN',
    accent: 'from-green-400/20 to-teal-400/10 border-green-400/30 text-green-100',
    bullets: [
      'Unit cards deploy only onto free tiles inside your own active landing zones.',
      'The MAIN is a special structure placed by the map and is not a normal shop unit.',
      'When a MAIN is destroyed, all landing-zone tiles owned by that player collapse.',
      'Wormhole temporary landing zones created by teleport effects last 5 turns before collapsing.',
      'Once your landing zones are gone, you cannot deploy new units unless another rule creates fresh deployment space.'
    ]
  },
  {
    code: '09',
    title: 'Cards And Inventory',
    accent: 'from-blue-400/20 to-cyan-400/10 border-blue-400/30 text-blue-100',
    bullets: [
      'There are two card families: unit cards and action cards.',
      'Unit cards deploy units. Action cards either resolve instantly or enter a targeting mode first.',
      'Inventory capacity is limited.',
      'Pending deliveries reserve inventory space before the cards actually arrive.'
    ]
  },
  {
    code: '10',
    title: 'Shop And Logistics',
    accent: 'from-slate-300/20 to-slate-500/10 border-slate-300/30 text-slate-100',
    bullets: [
      'Each active player starts with 500 credits.',
      'Each active player gains 20 credits at the start of their turn.',
      'Shop orders usually arrive after 1 to 3 rounds, with rare instant deliveries.',
      'At rounds 10, 25, and 50 the shop restocks and each active player receives 500 more credits; the normal +20 turn income is skipped during those rounds.',
      'After round 100, the shop shuts down and no further restocks occur.'
    ]
  },
  {
    code: '11',
    title: 'Neutral Creeps',
    accent: 'from-zinc-300/20 to-zinc-500/10 border-zinc-300/30 text-zinc-100',
    bullets: [
      'Neutral creeps are map-controlled units and do not belong to any player side.',
      'During the neutral phase, they attack the closest eligible non-neutral target they can legally hit.',
      'They do not treat other neutral units as enemies.',
      'Some neutral units can run additional scripted behaviors after their normal attack routine.'
    ]
  }
];

const quickFacts = [
  {
    label: 'Spawn Energy',
    value: '50%',
    className: 'border-violet-400/20 bg-violet-500/5',
    labelClass: 'text-violet-200/80'
  },
  {
    label: 'Turn Regen',
    value: '+5 EN',
    className: 'border-green-400/20 bg-green-500/5',
    labelClass: 'text-green-200/80'
  },
  {
    label: 'Shop Credits',
    value: '500 Start',
    className: 'border-cyan-400/20 bg-cyan-500/5',
    labelClass: 'text-cyan-200/80'
  },
  {
    label: 'Delivery',
    value: '1-3 Rounds',
    className: 'border-amber-400/20 bg-amber-500/5',
    labelClass: 'text-amber-200/80'
  }
];

const RulebookModal: React.FC<RulebookModalProps> = ({ onClose }) => {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/65 px-3 py-4 backdrop-blur-sm md:px-4 md:py-5">
      <div className="relative flex h-full max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl border border-cyan-400/30 bg-[#060b10]/95 shadow-[0_0_60px_rgba(34,211,238,0.15)]">
        <div
          className="pointer-events-none absolute inset-0 opacity-15"
          style={{
            backgroundImage:
              'linear-gradient(rgba(34,211,238,0.25) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.25) 1px, transparent 1px)',
            backgroundSize: '28px 28px'
          }}
        />

        <div className="relative z-10 flex items-start justify-between gap-4 border-b border-cyan-400/15 px-5 py-4 md:px-6">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.38em] text-cyan-300/70">Rulebook</div>
            <h2 className="mt-1 text-2xl font-black uppercase tracking-[0.14em] text-white md:text-3xl">
              Combat Protocol
            </h2>
            <p className="mt-2 max-w-4xl text-xs leading-5 text-slate-300 md:text-sm">
              Core match rules only. This manual covers formats, turn flow, movement, combat, deployment, logistics,
              neutral behavior, and victory conditions. Unit-by-unit stats stay in the catalogue.
            </p>
          </div>

          <button
            onClick={onClose}
            className="shrink-0 rounded-xl border border-cyan-400/35 bg-cyan-500/10 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-100 transition-colors hover:border-cyan-300 hover:bg-cyan-400/15 hover:text-white"
          >
            Close [Esc]
          </button>
        </div>

        <div className="relative z-10 overflow-y-auto game-scrollbar px-5 py-4 md:px-6">
          <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {quickFacts.map((fact) => (
              <div key={fact.label} className={`rounded-2xl border px-3 py-2.5 ${fact.className}`}>
                <div className={`text-[10px] font-bold uppercase tracking-[0.22em] ${fact.labelClass}`}>{fact.label}</div>
                <div className="mt-1 text-sm font-black uppercase tracking-[0.12em] text-white">{fact.value}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {sections.map((section) => (
              <section
                key={section.title}
                className={`rounded-2xl border bg-gradient-to-br p-4 ${section.accent}`}
              >
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-black/25 text-[11px] font-black uppercase tracking-[0.18em] text-white">
                    {section.code}
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-[0.14em] text-white md:text-base">
                    {section.title}
                  </h3>
                </div>

                <div className="space-y-2.5">
                  {section.bullets.map((bullet) => (
                    <div key={bullet} className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-black/15 px-3 py-2.5 text-[12px] leading-5 text-slate-100 md:text-[13px]">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-85" />
                      <span>{bullet}</span>
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
