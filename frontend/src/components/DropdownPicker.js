import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

export default function DropdownPicker({
  selectedValue,
  onValueChange,
  items = [], // Array of { label: string, value: any, color?: string }
  style,
  placeholder = "Wybierz opcję",
  dropdownIconColor,
  placeholderTextColor
}) {
  const { colors: C, themeColors, mode } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const triggerRef = useRef(null);
  const modalRef = useRef(null);
  const closeRef = useRef(null);
  const [focused, setFocused] = useState(null);
  const close = () => setModalVisible(false);
  const focusStyle = key => Platform.OS === 'web' && focused === key
    ? { outlineStyle: 'solid', outlineWidth: 2, outlineColor: C.accent, outlineOffset: -2 } : null;
  useEffect(() => {
    if (!modalVisible || Platform.OS !== 'web' || !modalRef.current) return;
    // RN Web traps Tab but does not isolate its portal's siblings.
    const background = Array.from(document.body.children)
      .filter(node => !node.contains(modalRef.current));
    const previous = background.map(node => [node, node.inert]);
    previous.forEach(([node]) => { node.inert = true; });
    closeRef.current?.focus();
    return () => {
      previous.forEach(([node, inert]) => { node.inert = inert; });
      triggerRef.current?.focus();
    };
  }, [modalVisible]);

  const selectedItem = items.find(i => String(i.value) === String(selectedValue));

  return (
    <>
      <TouchableOpacity 
        ref={triggerRef}
        accessibilityRole="button"
        accessibilityLabel={placeholder}
        accessibilityState={{ expanded: modalVisible }}
        {...(Platform.OS === 'web' ? { 'aria-expanded': modalVisible, 'aria-haspopup': 'dialog' } : {})}
        onFocus={() => setFocused('trigger')} onBlur={() => setFocused(null)}
        style={[styles.container, { backgroundColor: 'transparent', borderColor: themeColors.border }, style, focusStyle('trigger')]}
        onPress={() => setModalVisible(true)}
      >
        <Text style={[styles.text, { color: selectedItem ? themeColors.text : (placeholderTextColor || themeColors.textMuted) }]} numberOfLines={1}>
          {selectedItem ? selectedItem.label : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={20} color={dropdownIconColor || themeColors.textSecondary} />
      </TouchableOpacity>

      {modalVisible && <Modal ref={modalRef} visible transparent animationType={Platform.OS === 'web' ? 'none' : 'fade'} onRequestClose={close}
        accessibilityLabel={placeholder}>
        <View style={styles.modalOverlay}>
          <View style={StyleSheet.absoluteFill} onStartShouldSetResponder={() => true} onResponderRelease={close}
            {...(Platform.OS === 'web' ? { onClick: close } : {})} />
          <View style={[styles.modalContent, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
            <View style={[styles.modalHeader, { borderBottomColor: themeColors.border }]}>
              <Text style={[styles.modalTitle, { color: themeColors.text }]}>{placeholder}</Text>
              <TouchableOpacity ref={closeRef} accessibilityRole="button" accessibilityLabel="Zamknij wybór"
                onFocus={() => setFocused('close')} onBlur={() => setFocused(null)}
                onPress={close} style={[styles.closeBtn, focusStyle('close')]}>
                <Ionicons name="close" size={24} color={themeColors.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={items}
              keyExtractor={(item, index) => String(item.value) + index}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  onFocus={() => setFocused('item-' + item.value)} onBlur={() => setFocused(null)}
                  style={[
                    styles.itemBtn, 
                    String(item.value) === String(selectedValue) && { backgroundColor: C.accent + '20' },
                    { borderBottomColor: themeColors.border }
                    , focusStyle('item-' + item.value)
                  ]}
                  onPress={() => {
                    onValueChange(item.value);
                    setModalVisible(false);
                  }}
                >
                  <Text style={[
                    styles.itemText, 
                    { color: item.color || themeColors.text },
                    String(item.value) === String(selectedValue) && { color: mode === 'light' ? themeColors.text : C.accent, fontWeight: '700' }
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
        </View>
      </Modal>}
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
