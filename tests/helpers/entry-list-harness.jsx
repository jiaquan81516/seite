import { EntryList } from '../../src/components/EntryList';

export default function EntryListHarness({ entries, grouped = false }) {
  return (
    <EntryList
      entries={entries}
      grouped={grouped}
      filtered={false}
      day=""
      onEdit={() => {}}
      onAdd={() => {}}
      onClear={() => {}}
    />
  );
}
