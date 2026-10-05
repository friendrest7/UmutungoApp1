import { Icon, IconName } from './Icons';

type CategoryCardProps = { label: string; icon: IconName; index: string; onClick: () => void };

export function CategoryCard({ label, icon, index, onClick }: CategoryCardProps) {
  return <button className="category-card" type="button" onClick={onClick}><span className="category-index">{index}</span><span className="category-icon"><Icon name={icon} size={25} /></span><span className="category-name">{label}</span><Icon name="arrow" size={15} /></button>;
}
