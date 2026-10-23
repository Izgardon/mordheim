import type { PostbattlePetRow } from "./postbattle-utils";

/**
 * The pets that fought as their own models (step 5): how each ended, under its owner. It follows
 * its owner (Mutiny in Marienburg): no XP and no injury roll of its own.
 */
export default function PostbattlePetRows({ pets }: { pets: PostbattlePetRow[] }) {
  if (pets.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="battle-section-title">Pets</p>
      <ul className="space-y-2">
        {pets.map((pet) => (
          <li
            key={pet.unitKey}
            className="battle-card flex flex-wrap items-baseline justify-between gap-2 p-3 text-sm"
          >
            <span className="space-x-2">
              <span className="font-semibold text-foreground">{pet.name}</span>
              <span className="text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground">
                {pet.owner}
              </span>
            </span>
            <span className="space-x-3 text-xs">
              <span className={pet.outOfAction ? "text-red-300" : "text-muted-foreground"}>
                {pet.outOfAction ? "Out of action" : "In action"}
              </span>
              <span className="text-muted-foreground">
                {pet.kills} {pet.kills === 1 ? "kill" : "kills"}
              </span>
            </span>
            <span className="w-full text-xs italic text-muted-foreground">
              Follows its owner: no XP or injury roll.
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
