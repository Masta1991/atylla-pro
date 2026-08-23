import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

export default function DropdownPicker({
  selectedValue,
  onValueChange,
  items = [], // Array of { label: string, value: any, color?: string }
  style,
  placeholder = "Wybierz opcję",
  dropdownIconColor
}) {
  const { colors: C, themeColors } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);

  const selectedItem = items.find(i => String(i.value) === String(selectedValue));

  return (
    <>
      <TouchableOpacity 
        style={[styles.container, { backgroundColor: 'transparent', borderColor: themeColors.border }, style]} 
        onPress={() => setModalVisible(true)}
      >
        <Text style={[styles.text, { color: selectedItem ? themeColors.text : themeColors.textMuted }]} numberOfLines={1}>
          {selectedItem ? selectedItem.label : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={20} color={dropdownIconColor || themeColors.textSecondary} />
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setModalVisible(false)}>
          <View style={[styles.modalContent, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
            <View style={[styles.modalHeader, { borderBottomColor: themeColors.border }]}>
              <Text style={[styles.modalTitle, { color: themeColors.text }]}>{placeholder}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={themeColors.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={items}
              keyExtractor={(item, index) => String(item.value) + index}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[
                    styles.itemBtn, 
                    String(item.value) === String(selectedValue) && { backgroundColor: C.accent + '20' },
                    { borderBottomColor: themeColors.border }
                  ]}
                  onPress={() => {
                    onValueChange(item.value);
                    setModalVisible(false);
                  }}
                >
                  <Text style={[
                    styles.itemText, 
                    { color: item.color || themeColors.text },
                    String(item.value) === String(selectedValue) && { color: C.accent, fontWeight: '700' }
                  ]}>
                    {item.label}
                  </Text>
                  {String(item.value) === String(selectedValue) && (
                    <Ionicons name="checkmark" size={20} color={C.accent} />
                  )}
                </TouchableOpacity>
              )}
              contentContainerStyle={{ paddingBottom: 20 }}
              style={{ maxHeight: Platform.OS === 'web' ? '60vh' : '70%' }}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    height: 50,
    borderRadius: 8,
  },
  text: {
    fontSize: 15,
    flex: 1,
    marginRight: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  itemBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  itemText: {
    fontSize: 15,
  }
});
