import json
import re

def is_source_line(line):
    """Check if a line is a source reference (Town Cryer, Rulebook, etc.)"""
    source_prefixes = [
        'Town Cryer', 'Mordheim Rulebook', 'Border Town Burning',
        'Empire in Flames', 'Khemri setting', 'Nemesis Crown',
        'Opulent Goods', 'Ye Old Curiosity', 'Lustria setting',
        'Mordheim Annual'
    ]
    return any(line.startswith(prefix) for prefix in source_prefixes)

def is_annotation_or_section(line):
    """Check if a line is an annotation or section header, not an item"""
    annotation_patterns = [
        r'^Note\s+that',
        r'^Rarity$',
        r'^Arcane Lore$',
        r'^Poisons and Drugs$',
        r'^Claimed Gnoblars$',
        r'^Vehicles$',
        r'^The Wagons and Boats',
        r'^EXPANDED RULES$',
        r'^Skill Requirement$',
        r'^Armour$',
        r'^Healing Herbs$',
        r'^Drive Chariot',
        r'^Treat these Gnoblars',
        r'^Since the opulent coach',
    ]
    return any(re.match(pattern, line) for pattern in annotation_patterns)

def looks_like_item_name(line, next_lines):
    """Check if this line looks like an item name by examining following lines"""
    # Skip annotations and sections
    if is_annotation_or_section(line):
        return False

    # Item names should be followed by a source line or Cost: within 3 lines
    for i, next_line in enumerate(next_lines[:3]):
        if not next_line.strip():
            continue
        if is_source_line(next_line.strip()) or next_line.strip().startswith('Cost:'):
            return True
    return False

def parse_miscellaneous_items(text_file_path, output_json_path):
    """Parse miscellaneous items from text file and generate JSON seeder."""

    with open(text_file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    items = []
    lines = content.split('\n')

    i = 0
    while i < len(lines):
        line = lines[i].strip()

        # Skip empty lines and header sections
        if not line or line == 'Miscellaneous Equipment':
            i += 1
            continue

        # Skip intro paragraphs and annotations
        if (line.startswith('This section covers') or
            line.startswith('Only Heroes may') or
            is_annotation_or_section(line)):
            i += 1
            continue

        # Skip metadata/section headers
        if is_source_line(line) or line.startswith('Cost:') or line.startswith('Availability:') or line == 'Special Rules':
            i += 1
            continue

        # Check if this looks like an item name
        if looks_like_item_name(line, lines[i+1:i+4]):
            item = {
                'name': line,
                'type': 'Miscellaneous',
                'subtype': '',
                'grade': '',
                'cost': 0,
                'rarity': 5,
                'unique_to': '',
                'variable': None,
                'description': '',
                'strength': None,
                'range': None,
                'properties': []
            }

            i += 1

            # Skip empty lines and parse source/grade line
            while i < len(lines):
                line = lines[i].strip()
                if not line:
                    i += 1
                    continue

                if line.startswith('Cost:'):
                    break

                # Extract grade from source line
                if is_source_line(line):
                    grade_match = re.search(r'\((\d+[abc])\)', line)
                    if grade_match:
                        item['grade'] = grade_match.group(1)
                    i += 1
                else:
                    break

            # Parse Cost
            if i < len(lines) and lines[i].strip().startswith('Cost:'):
                cost_line = lines[i].strip()
                cost_match = re.search(r'Cost:\s*(\d+)', cost_line)
                if cost_match:
                    item['cost'] = int(cost_match.group(1))

                # Check for variable cost
                if '+' in cost_line:
                    var_match = re.search(r'\+\s*(\d*D\d+)', cost_line)
                    if var_match:
                        item['variable'] = var_match.group(1)

                i += 1

            # Parse Availability
            if i < len(lines) and lines[i].strip().startswith('Availability:'):
                avail_line = lines[i].strip()

                # Extract rarity
                if 'Common' in avail_line and 'Rare' not in avail_line:
                    item['rarity'] = 2
                else:
                    rarity_match = re.search(r'Rare\s+(\d+)', avail_line)
                    if rarity_match:
                        item['rarity'] = int(rarity_match.group(1))

                # Extract unique_to - find the FIRST occurrence of (...)only)
                unique_match = re.search(r'\(([^)]*only[^)]*?)\)', avail_line)
                if unique_match:
                    item['unique_to'] = unique_match.group(1)

                i += 1

            # Skip empty lines
            while i < len(lines) and not lines[i].strip():
                i += 1

            # Collect description
            description_lines = []
            while i < len(lines):
                line = lines[i].strip()

                if not line:
                    i += 1
                    continue

                if line == 'Special Rules':
                    break

                # Check if next item is starting
                if looks_like_item_name(line, lines[i+1:i+4]):
                    break

                # Skip annotations in description
                if is_annotation_or_section(line):
                    i += 1
                    continue

                description_lines.append(line)
                i += 1

            item['description'] = ' '.join(description_lines).strip()

            # Parse Special Rules
            if i < len(lines) and lines[i].strip() == 'Special Rules':
                i += 1
                special_rules_lines = []

                while i < len(lines):
                    line = lines[i].strip()

                    if not line:
                        i += 1
                        continue

                    # Check if this is the start of the next item
                    if looks_like_item_name(line, lines[i+1:i+4]):
                        break

                    # Skip annotations
                    if is_annotation_or_section(line):
                        i += 1
                        continue

                    special_rules_lines.append(line)
                    i += 1

                special_rules_text = '\n\n'.join(special_rules_lines).strip()
                if special_rules_text:
                    item['properties'] = [{
                        'name': item['name'],
                        'description': special_rules_text
                    }]

            items.append(item)
            continue

        i += 1

    # Write to JSON file
    with open(output_json_path, 'w', encoding='utf-8') as f:
        json.dump(items, f, indent=2, ensure_ascii=False)

    print(f"Parsed {len(items)} miscellaneous items")

    # Print first few item names for verification
    print("\nFirst 10 items:")
    for item in items[:10]:
        print(f"  - {item['name']} (Grade: {item['grade']}, Cost: {item['cost']}, Rarity: {item['rarity']})")

    print("\nLast 5 items:")
    for item in items[-5:]:
        print(f"  - {item['name']} (Grade: {item['grade']}, Cost: {item['cost']}, Rarity: {item['rarity']})")

    return items

if __name__ == '__main__':
    text_file = r'c:\Users\wsess\OneDrive\Documents\Coding\mordheim\backend\text_docs\miscellaneous.txt'
    output_file = r'c:\Users\wsess\OneDrive\Documents\Coding\mordheim\backend\apps\items\data\standard-misc.json'

    items = parse_miscellaneous_items(text_file, output_file)
    print(f"\nSuccessfully created {output_file}")
