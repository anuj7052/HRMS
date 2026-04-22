import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Avatar, Badge, Card, Row, SectionHeader } from '@/components/UI';
import { palette, statusColor, useTheme } from '@/theme';
import { useAppSelector } from '@/store';
import { AttendanceRecord, AttendanceStatus } from '@/types';

type RangeMode = 'Day' | 'Week' | 'Month';

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const startOfWeek = (d: Date) => {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
};

const formatDur = (h: number) => {
  if (!h || h <= 0) return '—';
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${hh}h ${mm}m`;
};

const EmployeeAttendanceProfileScreen: React.FC = () => {
  const t = useTheme();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const userId: string = route.params?.userId;
  const initialAnchor: string | undefined = route.params?.anchor;

  const employees = useAppSelector((s) => s.data.employees);
  const attendance = useAppSelector((s) => s.data.attendance);
  const leaves = useAppSelector((s) => s.data.leaves);
  const wfh = useAppSelector((s) => s.data.wfhRequests);
  const holidays = useAppSelector((s) => s.data.holidays);
  const corrections = useAppSelector((s) => s.data.corrections);
  const shifts = useAppSelector((s) => s.data.shifts);

  const emp = employees.find((e) => e.id === userId);
  const [mode, setMode] = useState<RangeMode>('Month');
  const [anchor, setAnchor] = useState<Date>(initialAnchor ? new Date(initialAnchor) : new Date());
  const [openDate, setOpenDate] = useState<string | null>(null);

  React.useLayoutEffect(() => {
    nav.setOptions({ title: emp ? emp.name : 'Profile' });
  }, [nav, emp]);

  if (!emp) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.colors.background }}>
        <Text style={{ color: t.colors.textMuted }}>Employee not found</Text>
      </View>
    );
  }

  const today = ymd(new Date());

  const range = useMemo(() => {
    if (mode === 'Day') return { from: ymd(anchor), to: ymd(anchor), label: anchor.toDateString() };
    if (mode === 'Week') {
      const s = startOfWeek(anchor);
      const e = new Date(s); e.setDate(s.getDate() + 6);
      return { from: ymd(s), to: ymd(e), label: `${ymd(s)} → ${ymd(e)}` };
    }
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    return { from: ymd(first), to: ymd(last), label: anchor.toLocaleString(undefined, { month: 'long', year: 'numeric' }) };
  }, [mode, anchor]);

  const datesInRange = useMemo(() => {
    const out: string[] = [];
    const s = new Date(range.from), e = new Date(range.to);
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) out.push(ymd(d));
    return out;
  }, [range.from, range.to]);

  const isWeekend = (d: string) => { const dd = new Date(d).getDay(); return dd === 0 || dd === 6; };
  const isHoliday = (d: string) => holidays.some((h) => h.date === d);

  const statusOnDate = (d: string): AttendanceStatus => {
    const rec = attendance.find((a) => a.userId === userId && a.date === d);
    if (rec) return rec.status;
    if (leaves.find((l) => l.userId === userId && l.status === 'Approved' && d >= l.from && d <= l.to)) return 'Leave';
    if (wfh.find((w) => w.userId === userId && w.status === 'Approved' && w.dates.includes(d))) return 'WFH';
    if (isHoliday(d)) return 'Holiday';
    if (isWeekend(d)) return 'Weekend';
    return 'Absent';
  };

  // Per-date detailed punch list (split single record into in/out events)
  const eventsForDate = (d: string) => {
    const rec = attendance.find((a) => a.userId === userId && a.date === d);
    const items: Array<{ time: string; kind: 'in' | 'out'; source: string }> = [];
    if (rec?.checkIn) items.push({ time: rec.checkIn, kind: 'in', source: rec.source });
    if (rec?.checkOut) items.push({ time: rec.checkOut, kind: 'out', source: rec.source });
    return items;
  };

  // Aggregates over the range
  const summary = useMemo(() => {
    const c: Record<AttendanceStatus, number> = { Present: 0, Absent: 0, WFH: 0, Leave: 0, Holiday: 0, Weekend: 0 };
    let totalHours = 0, lateCount = 0, earlyCount = 0, otCount = 0;
    let firstIn: string | null = null, lastOut: string | null = null;
    for (const d of datesInRange) {
      const s = statusOnDate(d);
      c[s] = (c[s] || 0) + 1;
      const rec = attendance.find((a) => a.userId === userId && a.date === d);
      if (rec) {
        totalHours += rec.workingHours || 0;
        if (rec.late) lateCount++;
        if (rec.earlyDeparture) earlyCount++;
        if (rec.overtime) otCount++;
        if (rec.checkIn && (!firstIn || rec.checkIn < firstIn)) firstIn = rec.checkIn;
        if (rec.checkOut && (!lastOut || rec.checkOut > lastOut)) lastOut = rec.checkOut;
      }
    }
    const workingDays = datesInRange.filter((d) => !isWeekend(d) && !isHoliday(d)).length;
    const attendancePct = workingDays > 0
      ? Math.round(((c.Present + c.WFH) / workingDays) * 100)
      : 0;
    const avgHours = c.Present + c.WFH > 0 ? totalHours / (c.Present + c.WFH) : 0;
    return { c, totalHours, lateCount, earlyCount, otCount, firstIn, lastOut, workingDays, attendancePct, avgHours };
  }, [datesInRange, attendance, leaves, wfh, holidays, userId]);

  // Recent punches across all time
  const allPunches = useMemo(
    () => attendance
      .filter((a) => a.userId === userId)
      .sort((a, b) => b.date.localeCompare(a.date)),
    [attendance, userId]
  );

  const shiftAnchor = (delta: number) => {
    const d = new Date(anchor);
    if (mode === 'Day') d.setDate(d.getDate() + delta);
    else if (mode === 'Week') d.setDate(d.getDate() + delta * 7);
    else d.setMonth(d.getMonth() + delta);
    setAnchor(d);
  };

  // Mini calendar for Month
  const monthGrid = useMemo(() => {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    const start = startOfWeek(first);
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      days.push(d);
      if (i >= 27 && d > last && d.getDay() === 0) break;
    }
    return { first, last, days };
  }, [anchor]);

  const personalCorrections = corrections.filter((c) => c.userId === userId);
  const personalLeaves = leaves.filter((l) => l.userId === userId);
  const personalWfh = wfh.filter((w) => w.userId === userId);

  const shift = shifts.find((s) => s.id === emp.shift) || shifts.find((s) => s.name === emp.shift);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.background }} contentContainerStyle={{ padding: 16 }}>
      {/* Header card */}
      <Card>
        <Row>
          <Avatar name={emp.name} size={56} />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={{ color: t.colors.text, fontSize: 18, fontWeight: '800' }}>{emp.name}</Text>
            <Text style={{ color: t.colors.textMuted, fontSize: 12, marginTop: 2 }}>
              {emp.empCode} · {emp.designation}
            </Text>
            <Text style={{ color: t.colors.textMuted, fontSize: 12, marginTop: 2 }}>
              {emp.department} · {emp.workMode}
            </Text>
          </View>
          <Badge label={statusOnDate(today)} color={statusColor(statusOnDate(today), t)} />
        </Row>
        <Row style={{ marginTop: 12, gap: 6, flexWrap: 'wrap' }}>
          <Badge label={emp.email} />
          <Badge label={emp.phone} />
          {shift && <Badge label={`Shift: ${shift.name || emp.shift}`} color={t.colors.primary} />}
        </Row>
      </Card>

      {/* Mode selector */}
      <Row style={{ gap: 6, marginTop: 14 }}>
        {(['Day', 'Week', 'Month'] as const).map((m) => (
          <Pressable
            key={m}
            onPress={() => setMode(m)}
            style={{
              flex: 1, paddingVertical: 8, borderRadius: 10,
              backgroundColor: mode === m ? t.colors.primary : t.colors.surface,
              borderWidth: 1, borderColor: mode === m ? t.colors.primary : t.colors.border,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: mode === m ? '#fff' : t.colors.text, fontWeight: '700', fontSize: 13 }}>{m}</Text>
          </Pressable>
        ))}
      </Row>

      {/* Range nav */}
      <Card style={{ marginTop: 10 }}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Pressable onPress={() => shiftAnchor(-1)} hitSlop={10}>
            <Ionicons name="chevron-back" size={22} color={t.colors.text} />
          </Pressable>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={{ color: t.colors.text, fontWeight: '700' }}>{range.label}</Text>
            <Text style={{ color: t.colors.textMuted, fontSize: 11, marginTop: 2 }}>
              {datesInRange.length} day{datesInRange.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <Pressable onPress={() => shiftAnchor(1)} hitSlop={10}>
            <Ionicons name="chevron-forward" size={22} color={t.colors.text} />
          </Pressable>
        </Row>
      </Card>

      {/* Summary */}
      <Row style={{ gap: 8, marginTop: 10 }}>
        <Card style={{ flex: 1 }}>
          <Text style={{ color: t.colors.textMuted, fontSize: 11 }}>Attendance</Text>
          <Text style={{ color: palette.present, fontSize: 20, fontWeight: '800', marginTop: 4 }}>
            {summary.attendancePct}%
          </Text>
          <Text style={{ color: t.colors.textMuted, fontSize: 10, marginTop: 2 }}>
            of {summary.workingDays} working day{summary.workingDays !== 1 ? 's' : ''}
          </Text>
        </Card>
        <Card style={{ flex: 1 }}>
          <Text style={{ color: t.colors.textMuted, fontSize: 11 }}>Total hours</Text>
          <Text style={{ color: t.colors.text, fontSize: 20, fontWeight: '800', marginTop: 4 }}>
            {summary.totalHours.toFixed(1)}
          </Text>
          <Text style={{ color: t.colors.textMuted, fontSize: 10, marginTop: 2 }}>
            avg {summary.avgHours.toFixed(1)} h / day
          </Text>
        </Card>
        <Card style={{ flex: 1 }}>
          <Text style={{ color: t.colors.textMuted, fontSize: 11 }}>Late / Early</Text>
          <Text style={{ color: palette.absent, fontSize: 20, fontWeight: '800', marginTop: 4 }}>
            {summary.lateCount}/{summary.earlyCount}
          </Text>
          <Text style={{ color: t.colors.textMuted, fontSize: 10, marginTop: 2 }}>
            OT days {summary.otCount}
          </Text>
        </Card>
      </Row>

      <Row style={{ gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        <Badge label={`Present ${summary.c.Present}`} color={palette.present} />
        <Badge label={`WFH ${summary.c.WFH}`} color={palette.wfh} />
        <Badge label={`Leave ${summary.c.Leave}`} color={palette.leave} />
        <Badge label={`Absent ${summary.c.Absent}`} color={palette.absent} />
        <Badge label={`Holiday ${summary.c.Holiday}`} color={t.colors.textMuted} />
        <Badge label={`Weekend ${summary.c.Weekend}`} color={t.colors.textMuted} />
      </Row>

      {/* Month calendar */}
      {mode === 'Month' && (
        <Card style={{ marginTop: 14 }}>
          <Row style={{ justifyContent: 'space-between', marginBottom: 6 }}>
            {['M','T','W','T','F','S','S'].map((w, i) => (
              <Text key={i} style={{ flex: 1, textAlign: 'center', color: t.colors.textMuted, fontSize: 11, fontWeight: '600' }}>
                {w}
              </Text>
            ))}
          </Row>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {monthGrid.days.map((d) => {
              const inMonth = d >= monthGrid.first && d <= monthGrid.last;
              const dStr = ymd(d);
              const s = inMonth ? statusOnDate(dStr) : 'Weekend';
              const c = statusColor(s, t);
              const selected = openDate === dStr;
              return (
                <Pressable
                  key={dStr}
                  disabled={!inMonth}
                  onPress={() => setOpenDate(selected ? null : dStr)}
                  style={{
                    width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', padding: 3,
                  }}
                >
                  <View
                    style={{
                      width: '100%', height: '100%', borderRadius: 8,
                      backgroundColor: inMonth ? c + '33' : 'transparent',
                      borderWidth: selected ? 2 : 1,
                      borderColor: inMonth ? (selected ? t.colors.primary : c + '99') : 'transparent',
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: inMonth ? t.colors.text : 'transparent', fontSize: 12, fontWeight: '700' }}>
                      {d.getDate()}
                    </Text>
                    {inMonth && (
                      <Text style={{ color: c, fontSize: 8, marginTop: 1, fontWeight: '700' }}>
                        {s.slice(0, 1)}
                      </Text>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
          {openDate && (
            <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: t.colors.border, paddingTop: 10 }}>
              <Text style={{ color: t.colors.text, fontWeight: '700', marginBottom: 6 }}>
                {new Date(openDate).toDateString()} — {statusOnDate(openDate)}
              </Text>
              {(() => {
                const ev = eventsForDate(openDate);
                if (!ev.length) {
                  return <Text style={{ color: t.colors.textMuted, fontSize: 12 }}>No punches recorded</Text>;
                }
                return ev.map((p, i) => (
                  <Row key={i} style={{ justifyContent: 'space-between', paddingVertical: 4 }}>
                    <Row>
                      <Ionicons
                        name={p.kind === 'in' ? 'log-in-outline' : 'log-out-outline'}
                        size={16}
                        color={p.kind === 'in' ? palette.present : palette.absent}
                      />
                      <Text style={{ color: t.colors.text, fontSize: 13, marginLeft: 6, fontWeight: '600' }}>
                        {p.kind === 'in' ? 'Check-in' : 'Check-out'}
                      </Text>
                    </Row>
                    <Text style={{ color: t.colors.text, fontSize: 13, fontWeight: '700' }}>{p.time}</Text>
                    <Badge label={p.source} />
                  </Row>
                ));
              })()}
            </View>
          )}
        </Card>
      )}

      {/* Day-by-day list */}
      <SectionHeader title="Day-by-day" />
      {datesInRange.slice().reverse().map((d) => {
        const rec = attendance.find((a) => a.userId === userId && a.date === d);
        const s = statusOnDate(d);
        const isOpen = openDate === d;
        return (
          <Card key={d} style={{ marginBottom: 8 }}>
            <Pressable onPress={() => setOpenDate(isOpen ? null : d)}>
              <Row style={{ justifyContent: 'space-between' }}>
                <View>
                  <Text style={{ color: t.colors.text, fontWeight: '700' }}>
                    {new Date(d).toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' })}
                  </Text>
                  <Text style={{ color: t.colors.textMuted, fontSize: 11, marginTop: 2 }}>
                    {rec?.checkIn || '--:--'} – {rec?.checkOut || '--:--'} · {formatDur(rec?.workingHours || 0)}
                  </Text>
                </View>
                <Row style={{ gap: 6 }}>
                  {rec?.late && <Badge label="Late" color={palette.absent} />}
                  {rec?.earlyDeparture && <Badge label="Early" color={palette.leave} />}
                  {rec?.overtime && <Badge label="OT" color={palette.wfh} />}
                  <Badge label={s} color={statusColor(s, t)} />
                </Row>
              </Row>
              {isOpen && (
                <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: t.colors.border, paddingTop: 8 }}>
                  {eventsForDate(d).length === 0 ? (
                    <Text style={{ color: t.colors.textMuted, fontSize: 12 }}>No punches recorded</Text>
                  ) : (
                    eventsForDate(d).map((p, i) => (
                      <Row key={i} style={{ justifyContent: 'space-between', paddingVertical: 3 }}>
                        <Row>
                          <Ionicons
                            name={p.kind === 'in' ? 'log-in-outline' : 'log-out-outline'}
                            size={14}
                            color={p.kind === 'in' ? palette.present : palette.absent}
                          />
                          <Text style={{ color: t.colors.text, fontSize: 12, marginLeft: 6 }}>
                            {p.kind === 'in' ? 'Check-in' : 'Check-out'}
                          </Text>
                        </Row>
                        <Text style={{ color: t.colors.text, fontSize: 12, fontWeight: '700' }}>{p.time}</Text>
                        <Text style={{ color: t.colors.textMuted, fontSize: 10 }}>{p.source}</Text>
                      </Row>
                    ))
                  )}
                  {rec?.location?.address && (
                    <Text style={{ color: t.colors.textMuted, fontSize: 11, marginTop: 6 }}>
                      📍 {rec.location.address}
                    </Text>
                  )}
                </View>
              )}
            </Pressable>
          </Card>
        );
      })}

      {/* Recent overall history */}
      <SectionHeader title={`All-time history (${allPunches.length})`} />
      {allPunches.slice(0, 30).map((rec) => (
        <Card key={rec.id} style={{ marginBottom: 6 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ color: t.colors.text, fontWeight: '600', fontSize: 13 }}>{rec.date}</Text>
            <Text style={{ color: t.colors.textMuted, fontSize: 12 }}>
              {rec.checkIn || '--:--'} – {rec.checkOut || '--:--'} · {formatDur(rec.workingHours || 0)}
            </Text>
            <Badge label={rec.status} color={statusColor(rec.status, t)} />
          </Row>
        </Card>
      ))}

      {/* Leaves / WFH / Corrections */}
      {personalLeaves.length > 0 && (
        <>
          <SectionHeader title={`Leaves (${personalLeaves.length})`} />
          {personalLeaves.slice(0, 10).map((l) => (
            <Card key={l.id} style={{ marginBottom: 6 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.colors.text, fontWeight: '600' }}>{l.type} · {l.days} day{l.days !== 1 ? 's' : ''}</Text>
                  <Text style={{ color: t.colors.textMuted, fontSize: 11 }}>{l.from} → {l.to}</Text>
                  {!!l.reason && (
                    <Text style={{ color: t.colors.textMuted, fontSize: 11, marginTop: 2 }} numberOfLines={2}>{l.reason}</Text>
                  )}
                </View>
                <Badge
                  label={l.status}
                  color={l.status === 'Approved' ? palette.present : l.status === 'Rejected' ? palette.absent : palette.leave}
                />
              </Row>
            </Card>
          ))}
        </>
      )}

      {personalWfh.length > 0 && (
        <>
          <SectionHeader title={`WFH requests (${personalWfh.length})`} />
          {personalWfh.slice(0, 10).map((w) => (
            <Card key={w.id} style={{ marginBottom: 6 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.colors.text, fontWeight: '600' }}>{w.dates.length} day{w.dates.length !== 1 ? 's' : ''}</Text>
                  <Text style={{ color: t.colors.textMuted, fontSize: 11 }} numberOfLines={2}>{w.dates.join(', ')}</Text>
                </View>
                <Badge
                  label={w.status}
                  color={w.status === 'Approved' ? palette.present : w.status === 'Rejected' ? palette.absent : palette.leave}
                />
              </Row>
            </Card>
          ))}
        </>
      )}

      {personalCorrections.length > 0 && (
        <>
          <SectionHeader title={`Correction requests (${personalCorrections.length})`} />
          {personalCorrections.slice(0, 10).map((c) => (
            <Card key={c.id} style={{ marginBottom: 6 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.colors.text, fontWeight: '600' }}>{c.date} · {c.reason}</Text>
                  <Text style={{ color: t.colors.textMuted, fontSize: 11 }} numberOfLines={2}>{c.detail}</Text>
                </View>
                <Badge
                  label={c.status}
                  color={c.status === 'Approved' ? palette.present : c.status === 'Rejected' ? palette.absent : palette.leave}
                />
              </Row>
            </Card>
          ))}
        </>
      )}

      <View style={{ height: 30 }} />
    </ScrollView>
  );
};

export default EmployeeAttendanceProfileScreen;
