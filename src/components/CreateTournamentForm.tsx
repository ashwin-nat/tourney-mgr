import { useEffect, useMemo, useState } from "react";
import type {
  NewTournamentInput,
  Participant,
  ParticipantHistory,
  TournamentFormat,
} from "../types";
import { makeId } from "../utils/id";

type Props = {
  onCreate: (input: NewTournamentInput) => void;
  participantHistory: Record<string, ParticipantHistory>;
  previousParticipants: Participant[];
};

type DraftParticipant = {
  id: string;
  name: string;
  rating: number;
};

function historicalRating(
  participantHistory: Record<string, ParticipantHistory>,
  name: string,
): number {
  const entry = participantHistory[name.trim().toLowerCase()];
  return entry ? Math.round(entry.elo) : 50;
}

function parseParticipants(
  raw: string,
  participantHistory: Record<string, ParticipantHistory>,
): Participant[] {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [nameRaw, ratingRaw] = line.split(",").map((v) => v.trim());
      const rating = Number.isFinite(Number(ratingRaw))
        ? Number(ratingRaw)
        : historicalRating(participantHistory, nameRaw);
      return { id: makeId("p"), name: nameRaw, rating };
    });
}

function createDraftParticipant(): DraftParticipant {
  return { id: makeId("pd"), name: "", rating: 50 };
}

function formatLabel(format: TournamentFormat): string {
  if (format === "GROUP_KO") return "Group + Knockout";
  if (format === "SWISS") return "Swiss";
  if (format === "LEAGUE") return "League";
  return "Knockout";
}

function timestampLabel(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function makeDefaultName(format: TournamentFormat): string {
  return `${formatLabel(format)} ${timestampLabel(new Date())}`;
}

function formatParticipantsForBulkEdit(participants: Array<Pick<Participant, "name" | "rating">>): string {
  return participants
    .filter((participant) => participant.name.trim())
    .map((participant) => `${participant.name.trim()},${participant.rating}`)
    .join("\n");
}

export function CreateTournamentForm({
  onCreate,
  participantHistory,
  previousParticipants,
}: Props) {
  const historyNames = useMemo(
    () =>
      Object.values(participantHistory)
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b)),
    [participantHistory],
  );
  const previousParticipantsRaw = useMemo(
    () => formatParticipantsForBulkEdit(previousParticipants),
    [previousParticipants],
  );
  const [format, setFormat] = useState<TournamentFormat>("KNOCKOUT");
  const [lastAutoName, setLastAutoName] = useState(() => makeDefaultName("KNOCKOUT"));
  const [name, setName] = useState(() => lastAutoName);
  const [draftParticipants, setDraftParticipants] = useState<DraftParticipant[]>([
    createDraftParticipant(),
    createDraftParticipant(),
  ]);
  const [participantsRaw, setParticipantsRaw] = useState(previousParticipantsRaw);
  const [groupCount, setGroupCount] = useState(2);
  const [advancePerGroup, setAdvancePerGroup] = useState(2);
  const [rounds, setRounds] = useState(5);
  const [faceOpponentsTwice, setFaceOpponentsTwice] = useState(false);
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

  useEffect(() => {
    setParticipantsRaw(previousParticipantsRaw);
  }, [previousParticipantsRaw]);

  return (
    <section className="panel">
      <h2>Create Tournament</h2>
      <div className="stack">
        <label>
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={lastAutoName}
          />
        </label>
        <label>
          Format
          <select
            value={format}
            onChange={(e) => {
              const nextFormat = e.target.value as TournamentFormat;
              setFormat(nextFormat);
              if (name === lastAutoName) {
                const auto = makeDefaultName(nextFormat);
                setName(auto);
                setLastAutoName(auto);
              }
            }}
          >
            <option value="KNOCKOUT">Pure Knockout</option>
            <option value="GROUP_KO">Group + Knockout</option>
            <option value="SWISS">Swiss</option>
            <option value="LEAGUE">League</option>
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
        {(format === "GROUP_KO" || format === "SWISS" || format === "LEAGUE") && (
          <label className="checkboxRow">
            <input
              type="checkbox"
              checked={faceOpponentsTwice}
              onChange={(e) => setFaceOpponentsTwice(e.target.checked)}
            />
            Face each opponent twice (home/away)
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
                        ? (() => {
                            const nextName = e.target.value;
                            const historyEntry =
                              participantHistory[nextName.trim().toLowerCase()];
                            return {
                              ...item,
                              name: nextName,
                              rating: historyEntry ? Math.round(historyEntry.elo) : item.rating,
                            };
                          })()
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
              const parsed = parseParticipants(participantsRaw, participantHistory);
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
          <button
            onClick={() =>
              setParticipantsRaw(
                formatParticipantsForBulkEdit(
                  draftParticipants.map((participant) => ({
                    name: participant.name,
                    rating: participant.rating,
                  })),
                ),
              )
            }
          >
            Refresh from Interactive List
          </button>
        </details>
        <button
          onClick={() => {
            const resolvedName = name.trim() || makeDefaultName(format);
            onCreate({
              name: resolvedName,
              format,
              participants,
              settings: {
                groupCount: format === "GROUP_KO" ? groupCount : undefined,
                advancePerGroup: format === "GROUP_KO" ? advancePerGroup : undefined,
                rounds: format === "SWISS" ? rounds : undefined,
                faceOpponentsTwice:
                  format === "GROUP_KO" || format === "SWISS" || format === "LEAGUE"
                    ? faceOpponentsTwice
                    : undefined,
                randomSeed: seed === "" ? undefined : Number(seed),
              },
            });
            const nextAutoName = makeDefaultName(format);
            setName(nextAutoName);
            setLastAutoName(nextAutoName);
            setDraftParticipants([createDraftParticipant(), createDraftParticipant()]);
            setParticipantsRaw(previousParticipantsRaw);
            setFaceOpponentsTwice(false);
          }}
          disabled={participants.length < 2}
        >
          Create
        </button>
      </div>
    </section>
  );
}
