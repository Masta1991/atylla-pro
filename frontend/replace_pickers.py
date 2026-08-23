import os
import re

src_dir = 'src/screens'
dropdown_import = "import DropdownPicker from '../components/DropdownPicker';"

def replace_in_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if '@react-native-picker/picker' not in content:
        return

    # Replace import
    content = re.sub(
        r"import\s*{\s*Picker\s*}\s*from\s*['\"]@react-native-picker/picker['\"];?",
        dropdown_import,
        content
    )

    # Find all pickers. This regex is tricky, but let's try to match `<Picker` up to `</Picker>` or `<View style={styles.pickerWrap}> ... </Picker>\s*</View>`
    # Actually, let's just do a manual replacement using multi_replace_file_content if this regex gets too complex.
    # We will just write a simple script that replaces <Picker ...> ... </Picker> with <DropdownPicker ... />
    
    # Let's find each <View style={styles.pickerWrap}>\s*<Picker ...>\s*<Picker.Item ...>\s*{...map(...)}\s*</Picker>\s*</View>
    pass

if __name__ == '__main__':
    for file in os.listdir(src_dir):
        if file.endswith('.js'):
            replace_in_file(os.path.join(src_dir, file))
