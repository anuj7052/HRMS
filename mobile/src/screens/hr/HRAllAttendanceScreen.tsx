import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Avatar, Badge, Card, Row, SectionHeader } from '@/components/UI';
import { palette, statusColor, useTheme } from '@/theme';
import { useAppSelector } from '@/store';
import { AttendanceRecord, AttendanceStatus, User } from '@/types';

type RangeMode = 'Day' | 'Week' | 'Month';

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const startOfWeek = (d: Date) => {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Mon = 0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
};
const monthMatrix = (anchor: Date) => {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const start = startOfWeek(first);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
    if (i >= 27 && d > last && d.getDay() === 0) break;
  }
  return { first, last, days };
};

/** Compute live working hours for an employee checked in today */
const liveHours = (checkIn: string | undefined, checkOut: string | undefined, now: Date): number => {
  if (!checkIn) return 0;
  const [h, m] = checkIn.split(':').map(Number);
  const end = checkOut
    ? (() => { const [h2, m2] = checkOut.split(':').map(Number); return h2 * 60 + m2; })()
    : now.getHours() * 60 + now.getMinutes();
  return Math.max(0, (end - (h * 60 + m)) / 60);
};

const HRAllAttendanceScreen: React.FC = () => {
  const t = useTheme();
  const nav = useNavigation<any>();
  const currentUser = useAppSelector((s) => s.auth.user)!;
  const allEmployees = useAppSelector((s) => s.data.employees);
  const attendance = useAppSelector((s) => s.data.attendance);
  const leaves = useAppSelector((s) => s.data.leaves);
  const wfh = useAppSelector((s) => s.data.wfhRequests);
  const holidays = useAppSelector((s) => s.data.holidays);

  // Role-based employee visibility: HR/CEO/Director see all; Manager sees only their team
  const isAdmin = currentUser.role === 'hr';
  const employees = isAdmin
    ? allEmployees
    : allEmployees.filter((e) => e.managerId === currentUser.id);

  // Live clock — updates every 30 seconds to refresh working-hours for checked-in staff
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'All' | AttendanceStatus>('All');
  const [dept, setDept] = useState('All');
  const [mode, setMode] = useState<RangeMode>('Day');
  const [anchor, setAnchor] = useState<Date>(new Date()); // pivot date for the view

  const today = ymd(new Date());

  // Range bounds
  const range = useMemo(() => {
    if (mode === 'Day') {
      const d = ymd(anchor);
      return { from: d, to: d, label: anchor.toDateString() };
    }
    if (mode === 'Week') {
      const s = startOfWeek(anchor);
      const e = new Date(s);
      e.setDate(s.getDate() + 6);
      return { from: ymd(s), to: ymd(e), label: `${ymd(s)} → ${ymd(e)}` };
    }
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    return {
      from: ymd(first),
      to: ymd(last),
      label: anchor.toLocaleString(undefined, { month: 'long', year: 'numeric' }),
    };
  }, [mode, anchor]);

  const departments = useMemo(
    () => ['All', ...Array.from(new Set(employees.map((e) => e.department))).filter(Boolean)],
    [employees]
  );

  const isHoliday = (d: string) => holidays.some((h) => h.date === d);
  const isWeekend = (d: string) => {
    const dt = new Date(d);
    const wd = dt.getDay();
    return wd === 0 || wd === 6;
  };

  const statusOnDate = (uid: string, d: string): AttendanceStatus => {
    const rec = attendance.find((a) => a.userId === uid && a.date === d);
    if (rec) return rec.status;
    if (leaves.find((l) => l.userId === uid && l.status === 'Approved' && d >= l.from && d <= l.to)) return 'Leave';
    if (wfh.find((w) => w.userId === uid && w.status === 'Approved' && w.dates.includes(d))) return 'WFH';
    if (isHoliday(d)) return 'Holiday';
    if (isWeekend(d)) return 'Weekend';
    return 'Absent';
  };

  // Build per-employee summary for the current range
  const datesInRange = useMemo(() => {
    const out: string[] = [];
    const s = new Date(range.from);
    const e = new Date(range.to);
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) out.push(ymd(d));
    return out;
  }, [range.from, range.to]);

  const summaries = useMemo(() => {
    const list = employees.filter((e) => e.active);
    return list.map((emp) => {
      const counts: Record<AttendanceStatus, number> = {
        Present: 0, Absent: 0, WFH: 0, Leave: 0, Holiday: 0, Weekend: 0,
      };
      const recs: AttendanceRecord[] = [];
      let totalHours = 0;
      for (const d of datesInRange) {
        const rec = attendance.find((a) => a.userId === emp.id && a.date === d);
        const s = statusOnDate(emp.id, d);
        counts[s] = (counts[s] || 0) + 1;
        if (rec) {
          recs.push(rec);
          totalHours += rec.workingHours || 0;
        }
      }
      const todayRec = attendance.find((a) => a.userId === emp.id && a.date === today);
      const liveStatus = statusOnDate(emp.id, today);
      return { emp, counts, recs, totalHours, todayRec, liveStatus };
    });
  }, [employees, attendance, datesInRange, today, leaves, wfh, holidays]);

  // Filter by search/dept/status (status filter applies to today's live status)
  const rows = useMemo(() => {
    return summaries
      .filter(({ emp }) => dept === 'All' || emp.department === dept)
      .filter(({ emp }) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return (
          emp.name.toLowerCase().includes(q) ||
          emp.empCode.toLowerCase().includes(q) ||
          emp.email.toLowerCase().includes(q)
        );
      })
      .filter(({ liveStatus }) => filter === 'All' || liveStatus === filter)
      .sort((a, b) => a.emp.name.localeCompare(b.emp.name));
  }, [summaries, dept, search, filter]);

  // Top totals — Day uses live "today" status; Week/Month sums Present days across range
  const totals = useMemo(() => {
    if (mode === 'Day') {
      const c: Record<string, number> = { Present: 0, WFH: 0, Leave: 0, Absent: 0 };
      rows.forEach(({ liveStatus }) => (c[liveStatus] = (c[liveStatus] ?? 0) + 1));
      return { Total: rows.length, ...c };
    }
    let p = 0, w = 0, l = 0, a = 0;
    rows.forEach(({ counts }) => { p += counts.Present; w += counts.WFH; l += counts.Leave; a += counts.Absent; });
    return { Total: rows.length, Present: p, WFH: w, Leave: l, Absent: a };
  }, [rows, mode]);

  const shiftAnchor = (delta: number) => {
    const d = new Date(anchor);
    if (mode === 'Day') d.setDate(d.getDate() + delta);
    else if (mode === 'Week') d.setDate(d.getDate() + delta * 7);
    else d.setMonth(d.getMonth() + delta);
    setAnchor(d);
  };

  const renderMiniMonth = (uid: string) => {
    const { first, last, days } = monthMatrix(anchor);
    return (
      <View style={{ marginTop: 10 }}>
        <Row style={{ justifyContent: 'space-between', marginBottom: 4 }}>
          {['M','T','W','T','F','S','S'].map((w, i) => (
            <Text key={i} style={{ flex: 1, textAlign: 'center', color: t.colors.textMuted, fontSize: 10 }}>{w}</Text>
          ))}
        </Row>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {days.map((d) => {
            const inMonth = d >= first && d <= last;
            const dStr = ymd(d);
            const s = inMonth ? statusOnDate(uid, dStr) : 'Weekend';
            const bg = inMonth ? statusColor(s, t) : 'transparent';
            return (
              <View
                key={dStr}
                style={{
                  width: '14.28%',
                  aspectRatio: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 2,
                }}
              >
                <View
                  style={{
                    width: '100%', height: '100%', borderRadius: 6,
                    backgroundColor: inMonth ? bg + '33' : 'transparent',
                    borderWidth: 1,
                    borderColor: inMonth ? bg + '99' : 'transparent',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: inMonth ? t.colors.text : 'transparent', fontSize: 10, fontWeight: '600' }}>
                    {d.getDate()}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.colors.background }}
      contentContainerStyle={{ padding: 16 }}
    >
      {/* Mode selector */}
      <Row style={{ gap: 6, marginBottom: 10 }}>
        {(['Day', 'Week', 'Month'] as const).map((m) => (
          <Pressable
            key={m}
            onPress={() => setMode(m)}
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: 10,
              backgroundColor: mode === m ? t.colors.primary : t.colors.surface,
              borderWidth: 1,
              borderColor: mode === m ? t.colors.primary : t.colors.border,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: mode === m ? '#fff' : t.colors.text, fontWeight: '700', fontSize: 13 }}>{m}</Text>
          </Pressable>
        ))}
      </Row>

      {/* Range picker */}
      <Card style={{ marginBottom: 10 }}>
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
        {ymd(anchor) !== today && (
          <Pressable
            onPress={() => setAnchor(new Date())}
            style={{ alignSelf: 'center', marginTop: 8, paddingVertical: 4, paddingHorizontal: 12, borderRadius: 999, backgroundColor: t.colors.primary + '22' }}
          >
            <Text style={{ color: t.colors.primary, fontSize: 11, fontWeight: '700' }}>Jump to today</Text>
          </Pressable>
        )}
      </Card>

      {/* Totals */}
      <Row style={{ gap: 8 }}>
        <Card style={{ flex: 1 }}>
          <Text style={{ color: t.colors.textMuted, fontSize: 11 }}>Total</Text>
          <Text style={{ color: t.colors.text, fontSize: 20, fontWeight: '800', marginTop: 4 }}>{totals.Total}</Text>
        </Card>
        <Card style={{ flex: 1 }}>
          <Text style={{ color: t.colors.textMuted, fontSize: 11 }}>{mode === 'Day' ? 'Present' : 'Present-days'}</Text>
          <Text style={{ color: palette.present, fontSize: 20, fontWeight: '800', marginTop: 4 }}>{totals.Present}</Text>
        </Card>
        <Card style={{ flex: 1 }}>
          <Text style={{ color: t.colors.textMuted, fontSize: 11 }}>WFH</Text>
          <Text style={{ color: palette.wfh, fontSize: 20, fontWeight: '800', marginTop: 4 }}>{totals.WFH}</Text>
        </Card>
        <Card style={{ flex: 1 }}>
          <Text style={{ color: t.colors.textMuted, fontSize: 11 }}>Absent</Text>
          <Text style={{ color: palette.absent, fontSize: 20, fontWeight: '800', marginTop: 4 }}>{totals.Absent}</Text>
        </Card>
      </Row>

      {/* Search */}
      <View style={{ marginTop: 14 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: t.colors.surface,
            borderRadius: 10,
            paddingHorizontal: 12,
            borderWidth: 1,
            borderColor: t.colors.border,
          }}
        >
          <Ionicons name="search" size={16} color={t.colors.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name, ID or email"
            placeholderTextColor={t.colors.textMuted}
            style={{ flex: 1, color: t.colors.text, paddingVertical: 10, paddingHorizontal: 8, fontSize: 14 }}
          />
        </View>
      </View>

      {/* Status filter */}
      <Row style={{ gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
        {(['All', 'Present', 'WFH', 'Leave', 'Absent'] as const).map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f as any)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: filter === f ? t.colors.primary : t.colors.surface,
              borderWidth: 1,
              borderColor: filter === f ? t.colors.primary : t.colors.border,
            }}
          >
            <Text style={{ color: filter === f ? '#fff' : t.colors.text, fontWeight: '600', fontSize: 12 }}>
              {f}
            </Text>
          </Pressable>
        ))}
      </Row>

      {/* Department filter */}
      <Row style={{ gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        {departments.map((d) => (
          <Pressable
            key={d}
            onPress={() => setDept(d)}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 999,
              backgroundColor: dept === d ? t.colors.primary + '22' : 'transparent',
              borderWidth: 1,
              borderColor: dept === d ? t.colors.primary : t.colors.border,
            }}
          >
            <Text style={{ color: dept === d ? t.colors.primary : t.colors.textMuted, fontSize: 11, fontWeight: '600' }}>
              {d}
            </Text>
          </Pressable>
        ))}
      </Row>

      <SectionHeader title={`${isAdmin ? 'All employees' : 'My team'} (${rows.length}) — ${mode}`} />

      {rows.map(({ emp, counts, recs, totalHours, todayRec, liveStatus }) => {
        const isLiveNow = todayRec?.checkIn && !todayRec?.checkOut && ymd(anchor) === today;
        const hrs = isLiveNow
          ? liveHours(todayRec?.checkIn, todayRec?.checkOut, now)
          : (todayRec?.workingHours || 0);
        return (
        <Card key={emp.id} style={{ marginBottom: 10 }}>
          <Pressable
            onPress={() =>
              nav.navigate('EmployeeAttendanceProfile', { userId: emp.id, anchor: ymd(anchor) })
            }
          >
            <Row style={{ justifyContent: 'space-between' }}>
              <Row style={{ flex: 1 }}>
                <Avatar name={emp.name} />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={{ color: t.colors.text, fontWeight: '700' }}>{emp.name}</Text>
                  <Text style={{ color: t.colors.textMuted, fontSize: 12, marginTop: 2 }}>
                    {emp.empCode} · {emp.designation}
                  </Text>
                  <Text style={{ color: t.colors.textMuted, fontSize: 11, marginTop: 1 }}>
                    {emp.department}
                  </Text>
                </View>
              </Row>
              <View style={{ alignItems: 'flex-end' }}>
                <Badge label={liveStatus} color={statusColor(liveStatus, t)} />
                <Text style={{ color: t.colors.textMuted, fontSize: 11, marginTop: 4 }}>
                  {todayRec?.checkIn || '--:--'} → {isLiveNow ? 'now' : (todayRec?.checkOut || '--:--')}
                </Text>
              </View>
            </Row>

            {mode === 'Day' && (
              <Row style={{ marginTop: 10, gap: 6, flexWrap: 'wrap' }}>
                <Badge label={`In ${todayRec?.checkIn || '--:--'}`} color={palette.present} />
                <Badge label={`Out ${isLiveNow ? 'working' : (todayRec?.checkOut || '--:--')}`} color={palette.absent} />
                <Badge
                  label={isLiveNow ? `⏱ ${hrs.toFixed(1)} h live` : `${hrs.toFixed(1)} h`}
                  color={isLiveNow ? t.colors.success : t.colors.primary}
                />
                {todayRec?.late && <Badge label="Late" color={palette.absent} />}
              </Row>
            )}

            {mode === 'Week' && (
              <View style={{ marginTop: 10 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  {datesInRange.map((d) => {
                    const s = statusOnDate(emp.id, d);
                    const c = statusColor(s, t);
                    return (
                      <View key={d} style={{ alignItems: 'center', flex: 1 }}>
                        <Text style={{ color: t.colors.textMuted, fontSize: 10 }}>
                          {new Date(d).toLocaleDateString(undefined, { weekday: 'short' })}
                        </Text>
                        <View
                          style={{
                            marginTop: 4,
                            width: 26, height: 26, borderRadius: 6,
                            backgroundColor: c + '33',
                            borderWidth: 1, borderColor: c,
                            alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          <Text style={{ color: t.colors.text, fontSize: 11, fontWeight: '600' }}>
                            {new Date(d).getDate()}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </Row>
                <Row style={{ marginTop: 10, gap: 6, flexWrap: 'wrap' }}>
                  <Badge label={`Present ${counts.Present}`} color={palette.present} />
                  <Badge label={`WFH ${counts.WFH}`} color={palette.wfh} />
                  <Badge label={`Leave ${counts.Leave}`} color={palette.leave} />
                  <Badge label={`Absent ${counts.Absent}`} color={palette.absent} />
                  <Badge label={`${totalHours.toFixed(1)} h`} color={t.colors.primary} />
                </Row>
              </View>
            )}

            {mode === 'Month' && (
              <View>
                {renderMiniMonth(emp.id)}
                <Row style={{ marginTop: 10, gap: 6, flexWrap: 'wrap' }}>
                  <Badge label={`Present ${counts.Present}`} color={palette.present} />
                  <Badge label={`WFH ${counts.WFH}`} color={palette.wfh} />
                  <Badge label={`Leave ${counts.Leave}`} color={palette.leave} />
                  <Badge label={`Absent ${counts.Absent}`} color={palette.absent} />
                  <Badge label={`${totalHours.toFixed(1)} h`} color={t.colors.primary} />
                </Row>
              </View>
            )}

            <Row style={{ marginTop: 10, justifyContent: 'flex-end' }}>
              <Text style={{ color: t.colors.primary, fontSize: 12, fontWeight: '700' }}>
                View profile <Ionicons name="chevron-forward" size={12} color={t.colors.primary} />
              </Text>
            </Row>
          </Pressable>
        </Card>
        );
      })}
    </ScrollView>
  );
};

export default HRAllAttendanceScreen;
