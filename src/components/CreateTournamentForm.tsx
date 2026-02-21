import { useMemo, useState } from "react";
import type { NewTournamentInput, Participant, TournamentFormat } from "../types";
import { makeId } from "../utils/id";

type Props = {
  onCreate: (input: NewTournamentInput) => void;
};

function parseParticipants(raw: string): Participant[] {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [nameRaw, ratingRaw] = line.split(",").map((v) => v.trim());
      const rating = Number.isFinite(Number(ratingRaw)) ? Number(ratingRaw) : 50;
      return { id: makeId("p"), name: nameRaw, rating };
    });
}

export function CreateTournamentForm({ onCreate }: Props) {
  const [name, setName] = useState("");
  const [format, setFormat] = useState<TournamentFormat>("KNOCKOUT");
  const [participantsRaw, setParticipantsRaw] = useState("");
  const [groupCount, setGroupCount] = useState(2);
  const [advancePerGroup, setAdvancePerGroup] = useState(2);
  const [rounds, setRounds] = useState(5);
  const [seed, setSeed] = useState("");
  const participants = useMemo(
    () => parseParticipants(participantsRaw),
    [participantsRaw],
  );

  return (
    <section className="panel">
      <h2>Create Tournament</h2>
      <div className="stack">
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Format
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as TournamentFormat)}
          >
            <option value="KNOCKOUT">Pure Knockout</option>
            <option value="GROUP_KO">Group + Knockout</option>
            <option value="SWISS">Swiss</option>
          </select>
        </label>
        {format === "GROUP_KO" && (
          <>
            <label>
              Group Count
              <input
                type="number"
                min={2}
                value={groupCount}
                onChange={(e) => setGroupCount(Number(e.target.value))}
              />
            </label>
            <label>
              Advance/Group
              <input
                type="number"
                min={1}
                value={advancePerGroup}
                onChange={(e) => setAdvancePerGroup(Number(e.target.value))}
              />
            </label>
          </>
        )}
        {format === "SWISS" && (
          <label>
            Swiss Rounds
            <input
              type="number"
              min={1}
              value={rounds}
              onChange={(e) => setRounds(Number(e.target.value))}
            />
          </label>
        )}
        <label>
          Random Seed (optional)
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            placeholder="e.g. 42"
          />
        </label>
        <label>
          Participants (one per line: <code>name,rating</code>)
          <textarea
            rows={8}
            value={participantsRaw}
            onChange={(e) => setParticipantsRaw(e.target.value)}
          />
        </label>
        <button
          onClick={() => {
            onCreate({
              name,
              format,
              participants,
              settings: {
                groupCount: format === "GROUP_KO" ? groupCount : undefined,
                advancePerGroup: format === "GROUP_KO" ? advancePerGroup : undefined,
                rounds: format === "SWISS" ? rounds : undefined,
                randomSeed: seed === "" ? undefined : Number(seed),
              },
            });
            setName("");
            setParticipantsRaw("");
          }}
          disabled={participants.length < 2}
        >
          Create
        </button>
      </div>
    </section>
  );
}
