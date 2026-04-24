import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Avatar, Badge, Card, Row, SectionHeader } from '@/components/UI';
import { statusColor, useTheme } from '@/theme';
import { getAttendanceByDate, getMonthlyReport } from '@/services/api';
import type { AttendanceByDateEntry, AttendanceDailyBreakdown, MonthlySummaryEntry } from '@/services/api';

type RangeMode = 'Day' | 'Week' | 'Month';

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DAYS_SHORT = ['Mo','Tu','We','Th','Fr','Sa','Su']; // Mon-first for calendar header

function mondayOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const r = new Date(d);
  r.setDate(r.getDate() + diff);
  r.setHours(0, 0, 0, 0);
  return r;
}

const STATUSES = ['All', 'Present', 'Late', 'WFH', 'Leave', 'Absent'] as const;

const HRAllAttendanceScreen: React.FC = () => {
  const t = useTheme();
  const nav = useNavigation<any>();

  const [mode, setMode] = useState<RangeMode>('Day');
  const [anchor, setAnchor] = useState(new Date());
  const [search, setSearch] = useState('');
  const [dept, setDept] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  const [feed, setFeed] = useState<AttendanceByDateEntry[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);

  const [monthlySummary, setMonthlySummary] = useState<MonthlySummaryEntry[]>([]);
  const [dailyBreakdown, setDailyBreakdown] = useState<AttendanceDailyBreakdown[]>([]);
  const [selectedCalDay, setSelectedCalDay] = useState<string | null>(null);
  const [monthlyLoading, setMonthlyLoading] = useState(false);

  // ── Range bounds ────────────────────────────────────────────────────────────
  const range = useMemo(() => {
    if (mode === 'Day') {
      const d = ymd(anchor);
      return { from: d, to: d, label: anchor.toDateString() };
    }
    if (mode === 'Week') {
      const mon = mondayOfWeek(anchor);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      return { from: ymd(mon), to: ymd(sun), label: `${ymd(mon)} → ${ymd(sun)}` };
    }
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const last  = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    return { from: ymd(first), to: ymd(last), label: `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}` };
  }, [mode, anchor]);

  // ── Fetch Day/Week ──────────────────────────────────────────────────────────
  const fetchFeed = useCallback(async () => {
    setFeedLoading(true);
    try {
      const res = await getAttendanceByDate(
        mode === 'Day' ? { date: range.from } : { from: range.from, to: range.to }
      );
      setFeed(res.feed);
    } catch { /* ignore */ } finally { setFeedLoading(false); }
  }, [mode, range.from, range.to]);

  // ── Fetch Month ─────────────────────────────────────────────────────────────
  const fetchMonthly = useCallback(async () => {
    setMonthlyLoading(true);
    try {
      const res = await getMonthlyReport(
        anchor.getMonth() + 1,
        anchor.getFullYear(),
        dept !== 'All' ? dept : undefined,
      );
      setMonthlySummary(res.summary);
      setDailyBreakdown(res.dailyBreakdown ?? []);
    } catch { /* ignore */ } finally { setMonthlyLoading(false); }
  }, [anchor, dept]);

  useEffect(() => {
    if (mode !== 'Month') fetchFeed();
    else fetchMonthly();
  }, [mode, fetchFeed, fetchMonthly]);

  // ── Departments list ────────────────────────────────────────────────────────
  const departments = useMemo(() => {
    const src = mode !== 'Month'
      ? feed.map((f) => f.department)
      : monthlySummary.map((s) => s.department);
    return ['All', ...Array.from(new Set(src)).filter(Boolean).sort()];
  }, [mode, feed, monthlySummary]);

  // ── Day filtered rows ───────────────────────────────────────────────────────
  const filteredFeed = useMemo(() => {
    let rows = feed;
    if (dept !== 'All') rows = rows.filter((r) => r.department === dept);
    if (statusFilter !== 'All') rows = rows.filter((r) => r.status === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((r) => r.name.toLowerCase().includes(q) || r.empCode.toLowerCase().includes(q));
    }
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  }, [feed, dept, statusFilter, search]);

  // ── Week: group by employee ─────────────────────────────────────────────────
  const weekData = useMemo(() => {
    if (mode !== 'Week') return { list: [], weekDates: [] };
    const mon = new Date(range.from + 'T00:00:00Z');
    const weekDates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(mon); d.setUTCDate(mon.getUTCDate() + i); return ymd(d);
    });
    const map = new Map<string, {
      empCode: string; employeeDbId: string; name: string; department: string;
      days: Record<string, string>;
    }>();
    filteredFeed.forEach((r) => {
      if (!map.has(r.empCode)) {
        map.set(r.empCode, { empCode: r.empCode, employeeDbId: r.employeeDbId, name: r.name, department: r.department, days: {} });
      }
      map.get(r.empCode)!.days[r.date] = r.status;
    });
    return { list: Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name)), weekDates };
  }, [mode, filteredFeed, range.from]);

  // ── Day: group by employee → first check-in, last check-out ────────────────
  const dayGrouped = useMemo(() => {
    if (mode !== 'Day') return [];
    const map = new Map<string, AttendanceByDateEntry & { firstIn: string | null; lastOut: string | null }>();
    filteredFeed.forEach((r) => {
      if (!map.has(r.employeeDbId)) {
        map.set(r.employeeDbId, { ...r, firstIn: r.punchIn, lastOut: r.punchOut });
      } else {
        const ex = map.get(r.employeeDbId)!;
        if (r.punchIn  && (!ex.firstIn  || r.punchIn  < ex.firstIn))  ex.firstIn  = r.punchIn;
        if (r.punchOut && (!ex.lastOut  || r.punchOut > ex.lastOut))  ex.lastOut  = r.punchOut;
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [mode, filteredFeed]);

  // ── Day totals ──────────────────────────────────────────────────────────────
  const dayTotals = useMemo(() => {
    const c: Record<string, number> = {};
    dayGrouped.forEach((r) => { c[r.status] = (c[r.status] ?? 0) + 1; });
    return c;
  }, [dayGrouped]);

  // ── Month filtered ──────────────────────────────────────────────────────────
  const filteredMonthly = useMemo(() => {
    let rows = monthlySummary;
    if (dept !== 'All') rows = rows.filter((r) => r.department === dept);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((r) => r.name.toLowerCase().includes(q) || r.employeeId.toLowerCase().includes(q));
    }
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  }, [monthlySummary, dept, search]);

  // ── Navigation ──────────────────────────────────────────────────────────────
  const shiftAnchor = (delta: number) => {
    const d = new Date(anchor);
    if (mode === 'Day')   d.setDate(d.getDate() + delta);
    else if (mode === 'Week')  d.setDate(d.getDate() + delta * 7);
    else d.setMonth(d.getMonth() + delta);
    setAnchor(d);
  };

  const isLoading = mode !== 'Month' ? feedLoading : monthlyLoading;
  const sc = (s: string) => statusColor(s as any, t);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.background }} contentContainerStyle={{ padding: 16 }}>

      {/* Mode selector */}
      <Row style={{ gap: 6, marginBottom: 12 }}>
        {(['Day', 'Week', 'Month'] as const).map((m) => (
          <Pressable
            key={m} onPress={() => setMode(m)}
            style={{
              flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
              backgroundColor: mode === m ? t.colors.primary : t.colors.surface,
              borderWidth: 1, borderColor: mode === m ? t.colors.primary : t.colors.border,
            }}
          >
            <Text style={{ color: mode === m ? '#fff' : t.colors.text, fontWeight: '700' }}>{m}</Text>
          </Pressable>
        ))}
      </Row>

      {/* Date navigator */}
      <Row style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <Pressable onPress={() => shiftAnchor(-1)} style={{ padding: 10 }}>
          <Ionicons name="chevron-back" size={22} color={t.colors.primary} />
        </Pressable>
        <Pressable onPress={() => { if (mode !== 'Month') fetchFeed(); else fetchMonthly(); }} style={{ alignItems: 'center' }}>
          <Text style={{ color: t.colors.text, fontWeight: '800', fontSize: 14 }}>{range.label}</Text>
          <Text style={{ color: t.colors.primary, fontSize: 11 }}>tap to refresh</Text>
        </Pressable>
        <Pressable onPress={() => shiftAnchor(1)} style={{ padding: 10 }}>
          <Ionicons name="chevron-forward" size={22} color={t.colors.primary} />
        </Pressable>
      </Row>

      {/* Search */}
      <View style={{
        backgroundColor: t.colors.surface, borderRadius: 10,
        paddingHorizontal: 12, paddingVertical: 10,
        flexDirection: 'row', alignItems: 'center', gap: 8,
        borderWidth: 1, borderColor: t.colors.border, marginBottom: 10,
      }}>
        <Ionicons name="search" size={18} color={t.colors.textMuted} />
        <TextInput
          value={search} onChangeText={setSearch}
          placeholder="Search name or ID"
          placeholderTextColor={t.colors.textMuted}
          style={{ flex: 1, color: t.colors.text }}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={t.colors.textMuted} />
          </Pressable>
        )}
      </View>

      {/* Department filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
        <Row style={{ gap: 6, paddingRight: 8 }}>
          {departments.map((d) => (
            <Pressable
              key={d} onPress={() => setDept(d)}
              style={{
                paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
                backgroundColor: dept === d ? t.colors.primary : t.colors.surface,
                borderWidth: 1, borderColor: dept === d ? t.colors.primary : t.colors.border,
              }}
            >
              <Text style={{ color: dept === d ? '#fff' : t.colors.text, fontWeight: '600', fontSize: 12 }}>{d}</Text>
            </Pressable>
          ))}
        </Row>
      </ScrollView>

      {/* Status filter — Day + Week only */}
      {mode !== 'Month' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
          <Row style={{ gap: 6, paddingRight: 8 }}>
            {STATUSES.map((s) => (
              <Pressable
                key={s} onPress={() => setStatusFilter(s)}
                style={{
                  paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
                  backgroundColor: statusFilter === s ? t.colors.primary : t.colors.surface,
                  borderWidth: 1, borderColor: statusFilter === s ? t.colors.primary : t.colors.border,
                }}
              >
                <Text style={{ color: statusFilter === s ? '#fff' : t.colors.text, fontWeight: '600', fontSize: 12 }}>{s}</Text>
              </Pressable>
            ))}
          </Row>
        </ScrollView>
      )}

      {isLoading ? (
        <ActivityIndicator color={t.colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <>
          {/* ── DAY VIEW ─────────────────────────────────────────────────── */}
          {mode === 'Day' && (
            <>
              <Card style={{ marginBottom: 12 }}>
                <Row style={{ justifyContent: 'space-around' }}>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ color: t.colors.text, fontWeight: '900', fontSize: 20 }}>{dayGrouped.length}</Text>
                    <Text style={{ color: t.colors.textMuted, fontSize: 11 }}>Total</Text>
                  </View>
                  {(['Present','Late','WFH','Leave','Absent'] as const).map((s) => (
                    <View key={s} style={{ alignItems: 'center' }}>
                      <Text style={{ color: sc(s), fontWeight: '900', fontSize: 20 }}>{dayTotals[s] ?? 0}</Text>
                      <Text style={{ color: t.colors.textMuted, fontSize: 11 }}>{s}</Text>
                    </View>
                  ))}
                </Row>
              </Card>

              {dayGrouped.length === 0 ? (
                <Card>
                  <Text style={{ color: t.colors.textMuted, textAlign: 'center', padding: 20 }}>
                    No attendance records for this date
                  </Text>
                </Card>
              ) : (
                dayGrouped.map((item) => {
                  // Use UTC to display times correctly (eSSL stores IST as UTC on Azure server)
                  const fmt = (iso: string | null) => {
                    if (!iso) return '—';
                    const d = new Date(iso);
                    const h = d.getUTCHours();
                    const m = String(d.getUTCMinutes()).padStart(2, '0');
                    const ampm = h >= 12 ? 'PM' : 'AM';
                    const h12 = h % 12 === 0 ? 12 : h % 12;
                    return `${String(h12).padStart(2, '0')}:${m} ${ampm}`;
                  };
                  const checkIn  = fmt(item.firstIn ?? null);
                  const checkOut = fmt(item.lastOut ?? null);
                  const hasIn    = !!(item.firstIn);
                  const hasOut   = !!(item.lastOut);

                  return (
                    <Pressable
                      key={item.employeeDbId}
                      onPress={() => nav.navigate('EmployeeAttendanceProfile', { employeeId: item.employeeDbId, name: item.name })}
                      style={{ marginBottom: 8 }}
                    >
                      <Card style={{ paddingBottom: 12 }}>
                        {/* Top row: avatar + name + status */}
                        <Row style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                          <Row style={{ flex: 1 }}>
                            <Avatar name={item.name} />
                            <View style={{ marginLeft: 12, flex: 1 }}>
                              <Text style={{ color: t.colors.text, fontWeight: '700', fontSize: 14 }}>{item.name}</Text>
                              <Text style={{ color: t.colors.textMuted, fontSize: 11, marginTop: 2 }}>
                                {item.empCode} · {item.department}
                              </Text>
                            </View>
                          </Row>
                          <Badge label={item.status} color={sc(item.status)} />
                        </Row>

                        {/* Divider */}
                        <View style={{ height: 1, backgroundColor: t.colors.border + '60', marginBottom: 10 }} />

                        {/* Check-in / Check-out rows */}
                        <Row style={{ gap: 12 }}>
                          {/* Check In */}
                          <View style={{
                            flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
                            backgroundColor: hasIn ? '#22C55E18' : t.colors.surfaceAlt,
                            borderRadius: 8, padding: 10,
                            borderWidth: 1, borderColor: hasIn ? '#22C55E50' : t.colors.border,
                          }}>
                            <Ionicons name="log-in-outline" size={18} color={hasIn ? '#22C55E' : t.colors.textMuted} />
                            <View>
                              <Text style={{ color: t.colors.textMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                                First In
                              </Text>
                              <Text style={{ color: hasIn ? '#22C55E' : t.colors.textMuted, fontWeight: '800', fontSize: 15, marginTop: 1 }}>
                                {checkIn}
                              </Text>
                            </View>
                          </View>

                          {/* Check Out */}
                          <View style={{
                            flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
                            backgroundColor: hasOut ? '#EF444418' : t.colors.surfaceAlt,
                            borderRadius: 8, padding: 10,
                            borderWidth: 1, borderColor: hasOut ? '#EF444450' : t.colors.border,
                          }}>
                            <Ionicons name="log-out-outline" size={18} color={hasOut ? '#EF4444' : t.colors.textMuted} />
                            <View>
                              <Text style={{ color: t.colors.textMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                                Last Out
                              </Text>
                              <Text style={{ color: hasOut ? '#EF4444' : t.colors.textMuted, fontWeight: '800', fontSize: 15, marginTop: 1 }}>
                                {checkOut}
                              </Text>
                            </View>
                          </View>
                        </Row>

                        {/* Work hours — only if both punches present */}
                        {item.workHours != null && item.workHours > 0 && (
                          <Text style={{ color: t.colors.textMuted, fontSize: 11, textAlign: 'right', marginTop: 8 }}>
                            Total: {item.workHours.toFixed(1)}h
                          </Text>
                        )}
                      </Card>
                    </Pressable>
                  );
                })
              )}
            </>
          )}

          {/* ── WEEK VIEW ────────────────────────────────────────────────── */}
          {mode === 'Week' && (
            <>
              <SectionHeader title={`Week: ${range.from} → ${range.to}`} />
              <Card style={{ marginBottom: 8 }}>
                <Row>
                  <View style={{ width: 130 }}>
                    <Text style={{ color: t.colors.textMuted, fontSize: 11, fontWeight: '700' }}>Employee</Text>
                  </View>
                  {weekData.weekDates.map((d) => {
                    const dd = new Date(d + 'T12:00:00Z');
                    return (
                      <View key={d} style={{ flex: 1, alignItems: 'center' }}>
                        <Text style={{ color: t.colors.textMuted, fontSize: 10, fontWeight: '700' }}>
                          {DAYS[dd.getUTCDay()]}
                        </Text>
                        <Text style={{ color: t.colors.textMuted, fontSize: 10 }}>{dd.getUTCDate()}</Text>
                      </View>
                    );
                  })}
                </Row>
              </Card>

              {weekData.list.length === 0 ? (
                <Card>
                  <Text style={{ color: t.colors.textMuted, textAlign: 'center', padding: 20 }}>
                    No records for this week
                  </Text>
                </Card>
              ) : (
                weekData.list.map((emp) => (
                  <Pressable
                    key={emp.empCode}
                    onPress={() => nav.navigate('EmployeeAttendanceProfile', { employeeId: emp.employeeDbId, name: emp.name })}
                    style={{ marginBottom: 6 }}
                  >
                    <Card>
                      <Row style={{ alignItems: 'center' }}>
                        <View style={{ width: 130 }}>
                          <Text style={{ color: t.colors.text, fontWeight: '700', fontSize: 12 }} numberOfLines={1}>{emp.name}</Text>
                          <Text style={{ color: t.colors.textMuted, fontSize: 10 }}>{emp.department}</Text>
                        </View>
                        {weekData.weekDates.map((d) => {
                          const s = emp.days[d];
                          const dow = new Date(d + 'T12:00:00Z').getUTCDay();
                          const isWeekend = dow === 0 || dow === 6;
                          return (
                            <View key={d} style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }}>
                              {s ? (
                                <View style={{
                                  width: 28, height: 28, borderRadius: 6,
                                  backgroundColor: sc(s) + '30',
                                  borderWidth: 1, borderColor: sc(s),
                                  alignItems: 'center', justifyContent: 'center',
                                }}>
                                  <Text style={{ color: sc(s), fontSize: 8, fontWeight: '800' }}>
                                    {s.substring(0, 2).toUpperCase()}
                                  </Text>
                                </View>
                              ) : (
                                <View style={{
                                  width: 28, height: 28, borderRadius: 6,
                                  backgroundColor: isWeekend ? t.colors.border + '40' : t.colors.danger + '15',
                                  borderWidth: 1, borderColor: isWeekend ? t.colors.border : t.colors.danger + '30',
                                  alignItems: 'center', justifyContent: 'center',
                                }}>
                                  <Text style={{ fontSize: 8, color: isWeekend ? t.colors.textMuted : t.colors.danger, fontWeight: '700' }}>
                                    {isWeekend ? 'WO' : 'AB'}
                                  </Text>
                                </View>
                              )}
                            </View>
                          );
                        })}
                      </Row>
                    </Card>
                  </Pressable>
                ))
              )}
            </>
          )}

          {/* ── MONTH VIEW — Calendar Grid ───────────────────────────── */}
          {mode === 'Month' && (
            <>
              <SectionHeader title={`${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`} />

              {/* Calendar Grid */}
              <Card style={{ marginBottom: 12, padding: 8 }}>
                {/* Day-of-week header (Mon → Sun) */}
                <View style={{ flexDirection: 'row', marginBottom: 4 }}>
                  {DAYS_SHORT.map((d) => (
                    <View key={d} style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={{ color: t.colors.textMuted, fontSize: 10, fontWeight: '700' }}>{d}</Text>
                    </View>
                  ))}
                </View>

                {/* Calendar cells */}
                {(() => {
                  const year  = anchor.getFullYear();
                  const month = anchor.getMonth();
                  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
                  const daysInMonth = new Date(year, month + 1, 0).getDate();
                  // offset so Monday=0
                  const offset = firstDay === 0 ? 6 : firstDay - 1;
                  const totalCells = Math.ceil((offset + daysInMonth) / 7) * 7;
                  const cells: (number | null)[] = [
                    ...Array(offset).fill(null),
                    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
                    ...Array(totalCells - offset - daysInMonth).fill(null),
                  ];
                  const rows: (number | null)[][] = [];
                  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

                  return rows.map((row, ri) => (
                    <View key={ri} style={{ flexDirection: 'row', marginBottom: 4 }}>
                      {row.map((day, ci) => {
                        if (!day) return <View key={ci} style={{ flex: 1 }} />;
                        const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`;
                        const bd = dailyBreakdown.find((b) => b.date === dateStr);
                        const isToday = dateStr === ymd(new Date());
                        const isSelected = dateStr === selectedCalDay;
                        const isWeekend = row.findIndex((_, i2) => i2 === ci) >= 5; // Sa, Su are indices 5,6

                        // Color based on attendance
                        let cellBg = t.colors.surface;
                        let dotColor = 'transparent';
                        if (bd) {
                          if (bd.present > 0 || bd.late > 0) {
                            const absentRatio = bd.absent / (bd.present + bd.late + bd.absent || 1);
                            if (absentRatio > 0.5) { dotColor = '#EF4444'; cellBg = '#EF444415'; }
                            else if (bd.late > bd.present) { dotColor = '#F59E0B'; cellBg = '#F59E0B15'; }
                            else { dotColor = '#22C55E'; cellBg = '#22C55E15'; }
                          } else if (isWeekend) {
                            cellBg = t.colors.border + '30';
                          }
                        }

                        return (
                          <Pressable
                            key={ci}
                            onPress={() => setSelectedCalDay(isSelected ? null : dateStr)}
                            style={{
                              flex: 1, alignItems: 'center', paddingVertical: 6, marginHorizontal: 1,
                              borderRadius: 8,
                              backgroundColor: isSelected ? t.colors.primary + '30' : cellBg,
                              borderWidth: isToday ? 2 : isSelected ? 1.5 : 0,
                              borderColor: isToday ? t.colors.primary : t.colors.primary + '80',
                            }}
                          >
                            <Text style={{
                              fontSize: 13, fontWeight: isToday ? '900' : '600',
                              color: isToday ? t.colors.primary : isWeekend ? t.colors.textMuted : t.colors.text,
                            }}>
                              {day}
                            </Text>
                            {dotColor !== 'transparent' && (
                              <View style={{
                                width: 5, height: 5, borderRadius: 3,
                                backgroundColor: dotColor, marginTop: 2,
                              }} />
                            )}
                            {bd && (
                              <Text style={{ fontSize: 8, color: t.colors.textMuted, marginTop: 1 }}>
                                {bd.present + bd.late}
                              </Text>
                            )}
                          </Pressable>
                        );
                      })}
                    </View>
                  ));
                })()}

                {/* Legend */}
                <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'center', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderColor: t.colors.border }}>
                  {[{ color: '#22C55E', label: 'Good' }, { color: '#F59E0B', label: 'Late' }, { color: '#EF4444', label: 'Low' }].map((l) => (
                    <View key={l.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: l.color }} />
                      <Text style={{ fontSize: 10, color: t.colors.textMuted }}>{l.label}</Text>
                    </View>
                  ))}
                </View>
              </Card>

              {/* Selected day detail — show employee summary */}
              {selectedCalDay && (() => {
                const bd = dailyBreakdown.find((b) => b.date === selectedCalDay);
                return (
                  <Card style={{ marginBottom: 10 }}>
                    <Text style={{ color: t.colors.text, fontWeight: '800', marginBottom: 6 }}>
                      {new Date(selectedCalDay + 'T12:00:00').toDateString()}
                    </Text>
                    {bd ? (
                      <Row style={{ gap: 8, flexWrap: 'wrap' }}>
                        <Badge label={`Present: ${bd.present}`} color="#22C55E" />
                        <Badge label={`Late: ${bd.late}`}       color="#F59E0B" />
                        <Badge label={`Absent: ${bd.absent}`}   color="#EF4444" />
                      </Row>
                    ) : (
                      <Text style={{ color: t.colors.textMuted, fontSize: 13 }}>No records</Text>
                    )}
                  </Card>
                );
              })()}

              {/* Monthly summary list */}
              <SectionHeader title={`Employee Summary — ${filteredMonthly.length} staff`} />
              {filteredMonthly.length === 0 ? (
                <Card>
                  <Text style={{ color: t.colors.textMuted, textAlign: 'center', padding: 20 }}>No records for this month</Text>
                </Card>
              ) : (
                filteredMonthly.map((item) => (
                  <Card key={item.employeeId} style={{ marginBottom: 8 }}>
                    <Row style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: t.colors.text, fontWeight: '700' }}>{item.name}</Text>
                        <Text style={{ color: t.colors.textMuted, fontSize: 12, marginTop: 2 }}>
                          {item.employeeId} · {item.department}
                        </Text>
                      </View>
                      <Text style={{ color: t.colors.textMuted, fontSize: 12 }}>{item.totalWorkHours}h</Text>
                    </Row>
                    <Row style={{ gap: 6, flexWrap: 'wrap' }}>
                      <Badge label={`Present: ${item.present}`} color={sc('Present')} />
                      <Badge label={`Late: ${item.late}`}       color={sc('Late')} />
                      <Badge label={`Absent: ${item.absent}`}   color="#9CA3AF" />
                      {item.leave > 0 && <Badge label={`Leave: ${item.leave}`} color={sc('Leave')} />}
                    </Row>
                  </Card>
                ))
              )}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
};

export default HRAllAttendanceScreen;
