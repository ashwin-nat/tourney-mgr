import { useMemo, useState } from "react";
import type { NewTournamentInput, Participant, TournamentFormat } from "../types";
import { makeId } from "../utils/id";

type Props = {
  onCreate: (input: NewTournamentInput) => void;
  historyNames: string[];
};

type DraftParticipant = {
  id: string;
  name: string;
  rating: number;
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

function createDraftParticipant(): DraftParticipant {
  return { id: makeId("pd"), name: "", rating: 50 };
}

export function CreateTournamentForm({ onCreate, historyNames }: Props) {
  const [name, setName] = useState("");
  const [format, setFormat] = useState<TournamentFormat>("KNOCKOUT");
  const [draftParticipants, setDraftParticipants] = useState<DraftParticipant[]>([
    createDraftParticipant(),
    createDraftParticipant(),
  ]);
  const [participantsRaw, setParticipantsRaw] = useState("");
  const [groupCount, setGroupCount] = useState(2);
  const [advancePerGroup, setAdvancePerGroup] = useState(2);
  const [rounds, setRounds] = useState(5);
  const [seed, setSeed] = useState("");
  const participants = useMemo(() => {
    const seen = new Set<string>();
    return draftParticipants
      .map((participant) => ({
        id: participant.id,
        name: participant.name.trim(),
        rating: participant.rating,
      }))
      .filter((participant) => {
        if (!participant.name) return false;
        const key = participant.name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [draftParticipants]);

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
        <div className="stack">
          <strong>Participants</strong>
          {draftParticipants.map((participant) => (
            <div className="participantRow" key={participant.id}>
              <input
                placeholder="Name"
                list="participant-history"
                value={participant.name}
                onChange={(e) =>
                  setDraftParticipants((current) =>
                    current.map((item) =>
                      item.id === participant.id
                        ? { ...item, name: e.target.value }
                        : item,
                    ),
                  )
                }
              />
              <input
                type="number"
                min={0}
                max={100}
                value={participant.rating}
                onChange={(e) =>
                  setDraftParticipants((current) =>
                    current.map((item) =>
                      item.id === participant.id
                        ? { ...item, rating: Number(e.target.value) }
                        : item,
                    ),
                  )
                }
              />
              <button
                className="danger"
                onClick={() =>
                  setDraftParticipants((current) =>
                    current.length > 1
                      ? current.filter((item) => item.id !== participant.id)
                      : current,
                  )
                }
                disabled={draftParticipants.length <= 2}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            onClick={() =>
              setDraftParticipants((current) => [...current, createDraftParticipant()])
            }
          >
            Add Participant
          </button>
          <datalist id="participant-history">
            {historyNames.map((historyName) => (
              <option key={historyName} value={historyName} />
            ))}
          </datalist>
        </div>
        <details>
          <summary>Optional Bulk Edit</summary>
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
              const parsed = parseParticipants(participantsRaw);
              setDraftParticipants(
                parsed.length
                  ? parsed.map((participant) => ({
                      id: makeId("pd"),
                      name: participant.name,
                      rating: participant.rating,
                    }))
                  : [createDraftParticipant(), createDraftParticipant()],
              );
            }}
          >
            Apply Bulk List
          </button>
        </details>
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
            setDraftParticipants([createDraftParticipant(), createDraftParticipant()]);
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
