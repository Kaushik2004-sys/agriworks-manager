// UI-only helper: familiar icon + always-visible work-type name.
// Icons support the text and never replace it.
const ICONS = {
  Ploughing: '🚜',
  Rotavator: '🔄',
  Cultivation: '🌱',
  Harvesting: '🌾',
  Irrigation: '💧',
  Other: '🧾',
  'Land Leveling': '📏',
};

export function workTypeIconName(workType) {
  return ICONS[workType] || '🚜';
}

export default function WorkTypeIcon({ type }) {
  return (
    <span aria-hidden="true" className="me-1">
      {workTypeIconName(type)}
    </span>
  );
}
