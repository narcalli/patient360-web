"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ChevronLeft, ChevronRight, HeartPulseIcon, PhoneIcon } from "@/components/icons";
import { EmptyState, ErrorBanner, PageHeader, RowsSkeleton, StatusBadge, useAreaBase, useToast } from "@/components/staff-ui";
import { api, ApiError, type EpisodeCandidate, type EpisodeToMatch, type RecordEpisode, type StaffPatient, type WaitingEpisode } from "@/lib/api";
import { ageFromDob, formatDate, formatMobile, genderLabel, initials } from "@/lib/format";
import { can } from "@/lib/session";
import { useSessionContext } from "@/lib/use-session";

// Care episodes from NeuronCX are matched to a patient by mobile number. When several patients share that mobile (a mother
// and her newborn, family members), the portal doesn't guess: the episode waits here until an admin or hospital staff member
// chooses whose it is. The API checks episodes.link again on every request.

/** How many episodes wait for a choice, for a link on the Patients page; null until known or when this person can't choose. */
export function useEpisodesToMatch(): number | null {
  const session = useSessionContext();
  const allowed = can(session, "episodes.link");
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    if (!allowed) return;
    let live = true;
    api
      .get<{ episodes: EpisodeToMatch[] }>("/episodes/to-match")
      .then((r) => live && setCount(r.episodes.length))
      .catch(() => live && setCount(null));
    return () => {
      live = false;
    };
  }, [allowed]);
  return allowed ? count : null;
}

/** A note on the Patients page when episodes wait for a patient, linking to the page that resolves them. */
export function EpisodesToMatchNote() {
  const base = useAreaBase();
  const count = useEpisodesToMatch();
  if (!count) return null;
  return (
    <Link
      href={`${base}/patients/episodes`}
      className="mt-6 flex items-center gap-3 rounded-[var(--radius-control)] bg-warn-soft px-4 py-3 text-sm text-ink transition-colors duration-150 hover:brightness-95"
    >
      <HeartPulseIcon size={18} className="shrink-0 text-warn" />
      <span className="min-w-0 flex-1">
        <span className="font-semibold">{count === 1 ? "1 care episode needs" : `${count} care episodes need`} a patient.</span>{" "}
        <span className="text-muted">Several patients share their mobile number, so someone has to choose.</span>
      </span>
      <span className="flex shrink-0 items-center gap-1 font-semibold text-brand">
        Choose <ChevronRight size={16} />
      </span>
    </Link>
  );
}

export function EpisodeMatchPage() {
  const session = useSessionContext();
  const base = useAreaBase();
  const [episodes, setEpisodes] = useState<EpisodeToMatch[] | null>(null);
  const [error, setError] = useState(false);
  const [choice, setChoice] = useState<{ episode: EpisodeToMatch; patient: EpisodeCandidate } | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const load = useCallback(() => {
    setError(false);
    api
      .get<{ episodes: EpisodeToMatch[] }>("/episodes/to-match")
      .then((r) => setEpisodes(r.episodes))
      .catch(() => setError(true));
  }, []);
  useEffect(load, [load]);

  async function confirm() {
    if (!choice) return;
    setBusy(true);
    try {
      await api.post(`/episodes/${encodeURIComponent(choice.episode.id)}/patient`, { patientId: choice.patient.id });
      toast.show(`${episodeTitle(choice.episode)} is now on ${choice.patient.fullName}'s record.`);
      setEpisodes((list) => list?.filter((e) => e.id !== choice.episode.id) ?? null);
    } catch (e) {
      const code = e instanceof ApiError ? e.code : null;
      toast.show(
        code === "NOT_WAITING"
          ? "Someone has already chosen the patient for this episode."
          : code === "NOT_A_CANDIDATE"
            ? "That patient no longer has this mobile number. The list has been refreshed."
            : "Couldn't save the choice. Please try again.",
      );
      if (code) load();
    } finally {
      setBusy(false);
      setChoice(null);
    }
  }

  if (!can(session, "episodes.link")) {
    return (
      <EmptyState icon={<HeartPulseIcon size={22} />} title="You can't choose patients for episodes">
        Ask a hospital admin if you need to.
      </EmptyState>
    );
  }

  return (
    <>
      <Link href={`${base}/patients`} className="btn-ghost -ml-3 mb-4">
        <ChevronLeft size={16} /> Patients
      </Link>
      <PageHeader
        title="Episodes to match"
        description="These care episodes came from NeuronCX with a mobile number that several patients share, such as a mother and her newborn. Choose whose record each one belongs to."
      />

      <section aria-label="Episodes" aria-busy={!episodes && !error} className="mt-6">
        {error ? (
          <ErrorBanner text="We couldn't load the episodes just now. Check your connection." onRetry={load} />
        ) : !episodes ? (
          <RowsSkeleton rows={3} />
        ) : episodes.length === 0 ? (
          <EmptyState icon={<HeartPulseIcon size={22} />} title="Nothing to match">
            Every care episode is on a patient&apos;s record, or waiting for its patient to be registered.
          </EmptyState>
        ) : (
          <>
            <p className="mb-3 text-sm text-muted" role="status">
              {episodes.length === 1 ? "1 episode" : `${episodes.length} episodes`}
            </p>
            <ul className="space-y-4">
              {episodes.map((e) => (
                <EpisodeCard key={e.id} episode={e} onChoose={(patient) => setChoice({ episode: e, patient })} />
              ))}
            </ul>
          </>
        )}
      </section>

      {choice && (
        <ConfirmDialog
          title={`Put this episode on ${choice.patient.fullName}'s record?`}
          confirmLabel="Yes, it's theirs"
          destructive={false}
          busy={busy}
          onConfirm={() => void confirm()}
          onCancel={() => setChoice(null)}
        >
          {episodeTitle(choice.episode)} ({choice.episode.name ?? "no name given"}) goes on {choice.patient.fullName}&apos;s record,
          ID {choice.patient.patientCode}. It stays there if anyone&apos;s mobile number changes later. Your choice is kept in the audit log.
        </ConfirmDialog>
      )}
      {toast.ui}
    </>
  );
}

const episodeTitle = (e: EpisodeToMatch) => `${e.type ?? "Care episode"}${e.episodeNo !== null ? ` #${e.episodeNo}` : ""}`;

function EpisodeCard({ episode: e, onChoose }: { episode: EpisodeToMatch; onChoose: (p: EpisodeCandidate) => void }) {
  const base = useAreaBase();
  const facts = [
    e.version,
    e.startedOn && `started ${formatDate(e.startedOn)}`,
    e.status && e.status.charAt(0) + e.status.slice(1).toLowerCase(),
  ].filter(Boolean);

  return (
    <li className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-bold">{episodeTitle(e)}</h2>
          <p className="mt-0.5 text-sm text-muted">{facts.join(" · ")}</p>
        </div>
        <div className="text-right text-sm">
          <p className="font-semibold">{e.name ?? <span className="font-normal text-muted italic">No name given</span>}</p>
          <p className="flex items-center justify-end gap-1.5 text-muted tabular">
            <PhoneIcon size={14} /> {formatMobile(e.mobile)}
          </p>
        </div>
      </div>

      <h3 className="mt-5 text-sm font-semibold text-muted">Patients with this mobile number</h3>
      <ul className="mt-2 divide-y divide-line rounded-[var(--radius-control)] border border-line">
        {e.candidates.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="avatar h-9 w-9 text-xs" aria-hidden="true">{initials(p.fullName)}</span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-semibold">
                <Link href={`${base}/patients/view?uuid=${p.id}`} className="hover:text-brand hover:underline">{p.fullName}</Link>
                {p.nameFits && <span className="badge bg-ok-soft text-ok">Name matches</span>}
              </p>
              <p className="text-sm text-muted tabular">
                {p.patientCode} · {p.dob ? `${formatDate(p.dob)} (${ageFromDob(p.dob)})` : "date of birth not recorded"}
                {genderLabel(p.gender) ? ` · ${genderLabel(p.gender)}` : ""}
              </p>
            </div>
            <button type="button" className={p.nameFits ? "btn h-10 px-4 text-sm" : "btn-secondary h-10 px-4 text-sm"} onClick={() => onChoose(p)}>
              This patient
            </button>
          </li>
        ))}
      </ul>
    </li>
  );
}

// ─── On a patient's record ───────────────────────────────────────────────────

const titleOf = (e: { type: string | null; episodeNo: number | null }) => `${e.type ?? "Care episode"}${e.episodeNo !== null ? ` #${e.episodeNo}` : ""}`;

/**
 * The patient's care episodes from NeuronCX: the ones on their record, and any on their mobile that wait for staff to choose
 * whose they are (a mother and her newborn share a number). Admins and hospital staff can put a waiting one on this record.
 */
export function PatientEpisodesCard({ patient }: { patient: StaffPatient["patient"] }) {
  const session = useSessionContext();
  const base = useAreaBase();
  const canChoose = can(session, "episodes.link");
  const [data, setData] = useState<{ episodes: RecordEpisode[]; waiting: WaitingEpisode[] } | null>(null);
  const [error, setError] = useState(false);
  const [choice, setChoice] = useState<WaitingEpisode | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const load = useCallback(() => {
    setError(false);
    api
      .get<{ episodes: RecordEpisode[]; waiting: WaitingEpisode[] }>(`/patients/${patient.id}/episodes`)
      .then(setData)
      .catch(() => setError(true));
  }, [patient.id]);
  useEffect(load, [load]);

  async function confirm() {
    if (!choice) return;
    setBusy(true);
    try {
      await api.post(`/episodes/${encodeURIComponent(choice.id)}/patient`, { patientId: patient.id });
      toast.show(`${titleOf(choice)} is now on ${patient.fullName}'s record.`);
    } catch (e) {
      const code = e instanceof ApiError ? e.code : null;
      toast.show(code === "NOT_WAITING" ? "Someone has already chosen the patient for this episode." : "Couldn't save the choice. Please try again.");
    } finally {
      setBusy(false);
      setChoice(null);
      load();
    }
  }

  return (
    <section aria-labelledby="episodes-title" className="card min-w-0 p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="episodes-title" className="text-base font-bold">Care episodes</h2>
        {data && <span className="text-sm text-muted tabular">{data.episodes.length}</span>}
      </div>

      {error ? (
        <div className="mt-4"><ErrorBanner text="We couldn't load the care episodes." onRetry={load} /></div>
      ) : !data ? (
        <div className="mt-4 space-y-2" aria-hidden="true">
          <span className="skeleton block h-4 w-1/2" />
          <span className="skeleton block h-3 w-2/3" />
        </div>
      ) : (
        <>
          {data.waiting.length > 0 && (
            <div className="mt-4 rounded-[var(--radius-control)] bg-warn-soft p-4">
              <p className="text-sm font-semibold">
                {data.waiting.length === 1 ? "An episode on this mobile number needs" : `${data.waiting.length} episodes on this mobile number need`} a patient
              </p>
              <p className="mt-0.5 text-sm text-muted">
                {data.waiting[0]!.othersOnMobile === 1 ? "1 other patient has" : `${data.waiting[0]!.othersOnMobile} other patients have`} the same number, so the portal
                didn&apos;t guess whose {data.waiting.length === 1 ? "it is" : "they are"}.
              </p>
              <ul className="mt-3 space-y-2">
                {data.waiting.map((w) => (
                  <li key={w.id} className="flex flex-wrap items-center gap-3 rounded-[var(--radius-control)] bg-surface px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 font-semibold">
                        {titleOf(w)}
                        {w.nameFits && <span className="badge bg-ok-soft text-ok">Name matches</span>}
                      </p>
                      <p className="text-sm text-muted">
                        For “{w.name ?? "no name given"}”{w.startedOn ? ` · started ${formatDate(w.startedOn)}` : ""}
                      </p>
                    </div>
                    {canChoose && (
                      <button type="button" className={w.nameFits ? "btn h-10 px-4 text-sm" : "btn-secondary h-10 px-4 text-sm"} onClick={() => setChoice(w)}>
                        Put on this record
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {canChoose && (
                <Link href={`${base}/patients/episodes`} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
                  See every episode to match <ChevronRight size={14} />
                </Link>
              )}
            </div>
          )}

          {data.episodes.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No care episodes on this record.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {data.episodes.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-brand-soft text-brand">
                    <HeartPulseIcon size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{titleOf(e)}</p>
                    <p className="mt-0.5 flex flex-wrap gap-x-1.5 text-sm text-muted">
                      {[
                        e.version,
                        e.startedOn && `started ${formatDate(e.startedOn)}`,
                        e.closedOn && `closed ${formatDate(e.closedOn)}`,
                        e.milestones.total > 0 && `${e.milestones.done} of ${e.milestones.total} milestones done`,
                        e.milestones.overdue > 0 && `${e.milestones.overdue} overdue`,
                        e.linkedBy === "STAFF" ? "matched by staff" : "matched by mobile number",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <StatusBadge status={e.status} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {choice && (
        <ConfirmDialog
          title={`Put ${titleOf(choice)} on ${patient.fullName}'s record?`}
          confirmLabel="Yes, it's theirs"
          destructive={false}
          busy={busy}
          onConfirm={() => void confirm()}
          onCancel={() => setChoice(null)}
        >
          The care system has this episode for “{choice.name ?? "no name given"}” on {formatMobile(patient.mobile)}. It goes on {patient.fullName}&apos;s
          record (ID {patient.patientCode}) and stays there if anyone&apos;s mobile number changes later. Your choice is kept in the audit log.
        </ConfirmDialog>
      )}
      {toast.ui}
    </section>
  );
}
