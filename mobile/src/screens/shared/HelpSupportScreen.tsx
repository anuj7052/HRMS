import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Row, SectionHeader } from '@/components/UI';
import { useTheme } from '@/theme';

const FAQS = [
  { q: 'How does ESSL attendance sync?', a: 'Device logs are fetched every 15 minutes via background cron and mapped to your employee code.' },
  { q: 'Can I cancel a WFH request?', a: 'Yes, open the WFH screen and tap the request to withdraw it before approval.' },
  { q: 'Why is my check-in button disabled?', a: 'Your work mode is WFO or no WFH is approved for today. Please punch on the ESSL device.' },
  { q: 'How do I raise an attendance correction?', a: 'Go to Attendance → Correction and submit with reason and optional document.' },
];

const HelpSupportScreen: React.FC = () => {
  const t = useTheme();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.background }} contentContainerStyle={{ padding: 16 }}>
      <Card>
        <Text style={{ color: t.colors.text, fontWeight: '700' }}>Need help?</Text>
        <Text style={{ color: t.colors.textMuted, marginTop: 6 }}>
          Reach out to our HR team or check the FAQs below.
        </Text>
        <View style={{ height: 12 }} />
        <Pressable onPress={() => Linking.openURL('mailto:hr@smarthrms.io')}>
          <Row style={{ gap: 10 }}>
            <Ionicons name="mail-outline" size={20} color={t.colors.primary} />
            <Text style={{ color: t.colors.primary, fontWeight: '600' }}>hr@smarthrms.io</Text>
          </Row>
        </Pressable>
        <View style={{ height: 10 }} />
        <Pressable onPress={() => Linking.openURL('tel:+911800123456')}>
          <Row style={{ gap: 10 }}>
            <Ionicons name="call-outline" size={20} color={t.colors.primary} />
            <Text style={{ color: t.colors.primary, fontWeight: '600' }}>+91 1800-123-456</Text>
          </Row>
        </Pressable>
      </Card>

      <SectionHeader title="FAQs" />
      {FAQS.map((f, i) => (
        <Pressable key={i} onPress={() => setOpen(open === i ? null : i)}>
          <Card style={{ marginBottom: 8 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={{ color: t.colors.text, fontWeight: '700', flex: 1, paddingRight: 8 }}>{f.q}</Text>
              <Ionicons name={open === i ? 'chevron-up' : 'chevron-down'} size={18} color={t.colors.textMuted} />
            </Row>
            {open === i && <Text style={{ color: t.colors.textMuted, marginTop: 8 }}>{f.a}</Text>}
          </Card>
        </Pressable>
      ))}
    </ScrollView>
  );
};

export default HelpSupportScreen;
