import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { Button, Card, Input, SectionTitle } from '@/components/ui';
import { colors, font, radius, spacing } from '@/lib/theme';
import { money, todayISO } from '@/lib/format';

interface ItemRow {
  description: string;
  qty: string;
  unit_price: string;
}

export default function NewQuotationScreen() {
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState(todayISO());
  const [venue, setVenue] = useState('');
  const [items, setItems] = useState<ItemRow[]>([{ description: '', qty: '1', unit_price: '' }]);
  const [discount, setDiscount] = useState('');
  const [tax, setTax] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const subtotal = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0);
  const total = subtotal - (Number(discount) || 0) + (Number(tax) || 0);

  const updateItem = (index: number, field: keyof ItemRow, value: string) =>
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, [field]: value } : it)));

  const addItem = () => setItems((prev) => [...prev, { description: '', qty: '1', unit_price: '' }]);
  const removeItem = (index: number) => setItems((prev) => prev.filter((_, i) => i !== index));

  const save = async () => {
    if (!clientName.trim()) return Alert.alert('Check the form', 'Client name is required');
    const clean = items
      .filter((it) => it.description.trim())
      .map((it) => ({
        description: it.description.trim(),
        qty: Number(it.qty) || 1,
        unit_price: Number(it.unit_price) || 0,
      }));
    if (clean.length === 0) return Alert.alert('Check the form', 'Add at least one item');

    setSaving(true);
    try {
      const res = await api.createQuotation({
        client_name: clientName,
        client_phone: clientPhone || undefined,
        client_email: clientEmail || undefined,
        event_name: eventName || undefined,
        event_date: eventDate || undefined,
        venue: venue || undefined,
        items: clean,
        discount: Number(discount) || 0,
        tax: Number(tax) || 0,
        notes: notes || undefined,
      });
      Alert.alert('Quotation created', `${res.quotation.quotation_number} — total ${money(res.quotation.total)}`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Failed', e?.message || 'Could not create the quotation');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
      <SectionTitle>Client</SectionTitle>
      <Card>
        <Input label="Client name *" value={clientName} onChangeText={setClientName} placeholder="e.g. Mr. Mehta" />
        <Input label="Client phone (for WhatsApp)" value={clientPhone} onChangeText={setClientPhone} placeholder="+91 …" keyboardType="phone-pad" />
        <Input label="Client email" value={clientEmail} onChangeText={setClientEmail} keyboardType="email-address" autoCapitalize="none" />
      </Card>

      <SectionTitle>Event</SectionTitle>
      <Card>
        <Input label="Event name" value={eventName} onChangeText={setEventName} placeholder="e.g. Wedding of daughter" />
        <Input label="Event date (YYYY-MM-DD)" value={eventDate} onChangeText={setEventDate} placeholder="2026-09-10" />
        <Input label="Venue" value={venue} onChangeText={setVenue} placeholder="e.g. Grand Palace, Mumbai" />
      </Card>

      <SectionTitle>Items</SectionTitle>
      <Card>
        {items.map((it, i) => (
          <View key={i} style={styles.itemRow}>
            <Input
              label={`Item ${i + 1}`}
              value={it.description}
              onChangeText={(v) => updateItem(i, 'description', v)}
              placeholder="Description"
              style={{ marginBottom: 0 }}
            />
            <View style={styles.itemMeta}>
              <Input label="Qty" value={it.qty} onChangeText={(v) => updateItem(i, 'qty', v)} keyboardType="numeric" style={{ flex: 1, marginRight: spacing.sm }} />
              <Input label="Unit price" value={it.unit_price} onChangeText={(v) => updateItem(i, 'unit_price', v)} keyboardType="numeric" style={{ flex: 2 }} />
              {items.length > 1 ? (
                <Pressable onPress={() => removeItem(i)} style={styles.removeBtn}>
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                </Pressable>
              ) : null}
            </View>
            {i < items.length - 1 ? <View style={styles.divider} /> : null}
          </View>
        ))}
        <Button title="Add Item" variant="secondary" icon="add" onPress={addItem} style={{ marginTop: spacing.md }} />
      </Card>

      <SectionTitle>Totals</SectionTitle>
      <Card>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Subtotal</Text>
          <Text style={styles.totalValue}>{money(subtotal)}</Text>
        </View>
        <Input label="Discount (Rs.)" value={discount} onChangeText={setDiscount} keyboardType="numeric" />
        <Input label="Tax (Rs.)" value={tax} onChangeText={setTax} keyboardType="numeric" />
        <View style={styles.totalRow}>
          <Text style={[styles.totalLabel, { fontWeight: '800' }]}>Total</Text>
          <Text style={[styles.totalValue, { color: colors.primary, fontWeight: '900' }]}>{money(total)}</Text>
        </View>
        <Input label="Notes (shown on PDF & WhatsApp)" value={notes} onChangeText={setNotes} multiline numberOfLines={2} />
      </Card>

      <Button title="Create Quotation" icon="checkmark-circle" onPress={save} loading={saving} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  itemRow: { marginBottom: spacing.md },
  itemMeta: { flexDirection: 'row', alignItems: 'flex-end', marginTop: spacing.sm },
  removeBtn: { padding: spacing.sm, marginLeft: spacing.xs, marginBottom: 12 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  totalLabel: { fontSize: font.md, color: colors.muted },
  totalValue: { fontSize: font.md, fontWeight: '700', color: colors.text },
});