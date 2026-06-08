import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ClipboardCheck, FileText, Package, ShieldCheck, Wrench } from 'lucide-react';
import {
  assignEngineerWorkOrder,
  acceptTicket,
  getEngineerTeam,
  getEngineerTickets,
  rejectTicket,
  updateEngineerStatus,
} from '../../services/api';
import { WorkOrderDetailModal } from '../WorkOrder/WorkOrderDetailModal';

const STATUS_LABELS = {
  pending: 'Pending Confirmation',
  pending_dispatch: 'Pending Regional Dispatch',
  assigned: 'Pending Confirmation',
  in_progress: 'In Service',
  pricing: 'Pending Quote',
  in_service: 'In Service',
  resolved: 'Awaiting Customer Confirmation',
  pending_review: 'Pending Archive',
  completed: 'Completed',
};

const CHECKLIST = [
  'Confirm customer issue, machine model, site contact, and arrival window',
  'Review the SAGEMRO AI intake summary and flag safety risks',
  'Check spare parts, tools, consumables, and protective equipment',
  'Record nameplate, alarm screen, and fault area photos on site',
  'Document service actions, parts replacement, and follow-up recommendations',
  'Submit the service report for customer confirmation',
];

// This component is the first shared implementation slice for the future
// engineer.sagemro.com portal. The customer main site should not remain the
// long-term engineer entry.
function groupTickets(tickets) {
  return {
    today: tickets.filter((ticket) => ['assigned', 'in_progress', 'in_service'].includes(ticket.status)),
    pending: tickets.filter((ticket) => ['pending', 'pending_dispatch', 'assigned'].includes(ticket.status)),
    active: tickets.filter((ticket) => ['in_progress', 'in_service', 'pricing'].includes(ticket.status)),
    reports: tickets.filter((ticket) => ['resolved', 'pending_review'].includes(ticket.status)),
    parts: tickets.filter((ticket) => /parts|备件|配件/i.test(`${ticket.type || ''} ${ticket.description || ''}`)),
  };
}

export function EngineerWorkspace({ currentUser, onLogout, onOpenProfile }) {
  const engineerId = localStorage.getItem('sagemro_engineer_id');
  const isRegionalLead =
    currentUser?.role === 'regional_lead' ||
    currentUser?.engineer_role === 'regional_lead' ||
    currentUser?.level === 'regional_lead';
  const [tickets, setTickets] = useState([]);
  const [team, setTeam] = useState([]);
  const [selectedEngineer, setSelectedEngineer] = useState({});
  const [assigningId, setAssigningId] = useState('');
  const [status, setStatus] = useState('available');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);

  const loadTickets = useCallback(async () => {
    if (!engineerId) return;
    setLoading(true);
    try {
      const data = await getEngineerTickets(engineerId);
      setTickets(data.work_orders || []);
    } catch (error) {
      setMessage(error.message || 'Failed to load service tasks');
    } finally {
      setLoading(false);
    }
  }, [engineerId]);

  const loadTeam = useCallback(async () => {
    if (!isRegionalLead) return;
    try {
      const data = await getEngineerTeam();
      setTeam(data.engineers || []);
    } catch (error) {
      setMessage(error.message || 'Failed to load team engineers');
    }
  }, [isRegionalLead]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    loadTeam();
  }, [loadTeam]);

  const updateStatus = async (nextStatus) => {
    setStatus(nextStatus);
    try {
      await updateEngineerStatus({ engineer_id: engineerId, status: nextStatus });
    } catch (error) {
      setMessage(error.message || 'Failed to update availability');
    }
  };

  const assignToEngineer = async (ticket) => {
    const engineerIdToAssign = selectedEngineer[ticket.id];
    if (!engineerIdToAssign) {
      setMessage('Please select a service engineer first');
      return;
    }
    setAssigningId(ticket.id);
    setMessage('');
    try {
      const data = await assignEngineerWorkOrder({
        work_order_id: ticket.id,
        engineer_id: engineerIdToAssign,
      });
      const assigned = data.work_order || {};
      setTickets((prev) => prev.map((item) => (
        item.id === ticket.id
          ? {
              ...item,
              status: assigned.status || 'assigned',
              engineer_id: assigned.engineer_id,
              engineer_name: assigned.engineer_name,
              conflict_status: 'clear',
              conflict_reason: '',
            }
          : item
      )));
      setMessage(`Assigned: ${ticket.order_no || ticket.id}`);
    } catch (error) {
      setMessage(error.message || 'Failed to assign engineer');
    } finally {
      setAssigningId('');
    }
  };

  const confirmAssignment = async (ticket) => {
    setAssigningId(`${ticket.id}:accept`);
    setMessage('');
    try {
      await acceptTicket({ work_order_id: ticket.id, engineer_id: engineerId });
      setMessage(`Assignment confirmed: ${ticket.order_no || ticket.id}`);
      await loadTickets();
    } catch (error) {
      setMessage(error.message || 'Failed to confirm assignment');
    } finally {
      setAssigningId('');
    }
  };

  const returnAssignment = async (ticket) => {
    setAssigningId(`${ticket.id}:reject`);
    setMessage('');
    try {
      await rejectTicket({ work_order_id: ticket.id, engineer_id: engineerId });
      setMessage(`Returned to dispatch: ${ticket.order_no || ticket.id}`);
      await loadTickets();
    } catch (error) {
      setMessage(error.message || 'Failed to return assignment');
    } finally {
      setAssigningId('');
    }
  };

  const grouped = groupTickets(tickets);
  const metrics = [
    ...(isRegionalLead ? [{ icon: ClipboardCheck, label: 'Regional Queue', value: grouped.pending.length }] : []),
    { icon: ClipboardCheck, label: "Today's Tasks", value: grouped.today.length },
    { icon: AlertTriangle, label: 'Pending Confirmation', value: grouped.pending.length },
    { icon: Wrench, label: 'In Service', value: grouped.active.length },
    { icon: FileText, label: 'Reports Due', value: grouped.reports.length },
    { icon: Package, label: 'Parts Needs', value: grouped.parts.length },
  ];

  return (
    <>
    <div className="h-[100dvh] overflow-y-auto bg-[var(--color-bg)] text-[var(--color-text-primary)]">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-[var(--color-primary)]">SAGEMRO</div>
            <h1 className="text-xl font-semibold">
              {isRegionalLead ? 'Regional Lead Workspace' : 'Engineer Workspace'}
            </h1>
            <p className="text-sm text-[var(--color-text-muted)]">SAGEMRO Service Console</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onOpenProfile}
              className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            >
              {currentUser?.name || 'Engineer Profile'}
            </button>
            <button
              onClick={onLogout}
              className="rounded-xl bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-6">
        {message && (
          <div className="mb-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
            {message}
          </div>
        )}

        <section className="mb-6 grid gap-4 lg:grid-cols-[1.7fr_1fr]">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-semibold">Task Overview</h2>
                <p className="text-sm text-[var(--color-text-muted)]">Only service tasks assigned through SAGEMRO are shown here.</p>
              </div>
              <div className="flex gap-2">
                {[
                  { value: 'available', label: 'Available' },
                  { value: 'paused', label: 'Paused' },
                  { value: 'offline', label: 'Offline' },
                ].map((item) => (
                  <button
                    key={item.value}
                    onClick={() => updateStatus(item.value)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                      status === item.value
                        ? 'bg-[var(--color-primary)] text-white'
                        : 'bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {metrics.map((metric) => (
                <div key={metric.label} className="rounded-xl bg-[var(--color-surface-elevated)] p-4">
                  <metric.icon size={18} className="mb-2 text-[var(--color-primary)]" />
                  <div className="text-2xl font-semibold">{metric.value}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">{metric.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheck size={18} className="text-[var(--color-primary)]" />
              <h2 className="font-semibold">Service Standard Checklist</h2>
            </div>
            <div className="space-y-2">
              {CHECKLIST.map((item) => (
                <label key={item} className="flex gap-2 text-sm text-[var(--color-text-secondary)]">
                  <input type="checkbox" className="mt-1" />
                  <span>{item}</span>
                </label>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <h2 className="mb-4 font-semibold">Service Tasks</h2>
            {loading ? (
              <div className="py-10 text-center text-sm text-[var(--color-text-muted)]">Loading...</div>
            ) : tickets.length === 0 ? (
              <div className="py-10 text-center text-sm text-[var(--color-text-muted)]">No assigned service tasks yet</div>
            ) : (
              <div className="space-y-3">
                {tickets.map((ticket) => (
                  <article key={ticket.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{ticket.order_no || ticket.id}</div>
                        <div className="text-sm text-[var(--color-text-muted)]">
                          {ticket.customer_name || 'Customer'} · {ticket.customer_region || 'Region pending'}
                        </div>
                      </div>
                      <span className="rounded-lg bg-[var(--color-primary)]/10 px-2 py-1 text-xs text-[var(--color-primary)]">
                        {STATUS_LABELS[ticket.status] || ticket.status}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--color-text-secondary)]">{ticket.description || 'No service description yet'}</p>
                    <div className="mt-3 grid gap-2 text-xs text-[var(--color-text-muted)] sm:grid-cols-3">
                      <div>Customer issue: {ticket.type || '-'}</div>
                      <div>Safety risk: {ticket.urgency === 'critical' ? 'High risk' : ticket.urgency === 'urgent' ? 'Priority' : 'Standard'}</div>
                      <div>Current engineer: {ticket.engineer_name || 'Pending regional assignment'}</div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => setSelectedTicket(ticket)}
                        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-medium text-[var(--color-text-primary)] hover:border-[var(--color-primary)]"
                      >
                        View / Handle Task
                      </button>
                      {!isRegionalLead && ticket.status === 'assigned' && (
                        <>
                          <button
                            onClick={() => confirmAssignment(ticket)}
                            disabled={assigningId === `${ticket.id}:accept`}
                            className="rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                          >
                            {assigningId === `${ticket.id}:accept` ? 'Confirming' : 'Confirm Assignment'}
                          </button>
                          <button
                            onClick={() => returnAssignment(ticket)}
                            disabled={assigningId === `${ticket.id}:reject`}
                            className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] disabled:opacity-50"
                          >
                            {assigningId === `${ticket.id}:reject` ? 'Returning' : 'Return to Dispatch'}
                          </button>
                        </>
                      )}
                    </div>
                    {ticket.conflict_status === 'blocked' && (
                      <div className="mt-3 rounded-lg border border-[var(--color-error)]/30 bg-[var(--color-error)]/10 px-3 py-2 text-xs text-[var(--color-error)]">
                        Conflict check: {ticket.conflict_reason || 'This engineer cannot receive this work order'}
                      </div>
                    )}
                    {isRegionalLead && (
                      <div className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                        <div className="text-xs font-medium text-[var(--color-text-primary)]">Regional Lead Assignment</div>
                        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                          <select
                            value={selectedEngineer[ticket.id] || ticket.engineer_id || ''}
                            onChange={(event) => setSelectedEngineer((prev) => ({ ...prev, [ticket.id]: event.target.value }))}
                            className="min-w-0 flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
                          >
                            <option value="">Select team engineer</option>
                            {team.map((engineer) => (
                              <option key={engineer.id} value={engineer.id}>
                                {engineer.name}{engineer.service_region ? ` · ${engineer.service_region}` : ''}{engineer.status ? ` · ${engineer.status}` : ''}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => assignToEngineer(ticket)}
                            disabled={assigningId === ticket.id}
                            className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                          >
                            {assigningId === ticket.id ? 'Assigning' : 'Assign Engineer'}
                          </button>
                        </div>
                        <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                          SAGEMRO blocks assignments when customer and engineer profiles show phone, company, or address conflicts.
                        </p>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
              <h2 className="mb-3 font-semibold">AI Intake Summary</h2>
              <p className="text-sm text-[var(--color-text-secondary)]">
                When a task has intake details, this area should show symptoms, possible causes, safety risks, suggested spare parts, and on-site inspection priorities.
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
              <h2 className="mb-3 font-semibold">Customer Equipment Record</h2>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Machine model, brand, service history, photos, and service reports will support better preparation before the site visit.
              </p>
            </div>
          </aside>
        </section>
      </main>
    </div>
    <WorkOrderDetailModal
      isOpen={Boolean(selectedTicket)}
      onClose={() => setSelectedTicket(null)}
      workOrder={selectedTicket}
      userType="engineer"
      userId={engineerId}
      onRateSuccess={loadTickets}
      onConfirmed={loadTickets}
    />
    </>
  );
}
