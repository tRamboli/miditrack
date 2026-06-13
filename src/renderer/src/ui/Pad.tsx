import { ReactNode } from 'react';

type Props = {
  label: ReactNode;
  active?: boolean;
  flash?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  variant?: 'red' | 'amber' | 'green' | 'yellow' | 'white' | 'purple';
  onClick?: () => void;
  title?: string;
  block?: boolean;
};

export function Pad({
  label,
  active,
  flash,
  size = 'md',
  variant = 'red',
  onClick,
  title,
  block
}: Props) {
  const cls = [
    'pad',
    `pad--${size}`,
    `pad--${variant}`,
    active ? 'is-active' : '',
    flash ? 'is-flash' : '',
    block ? 'pad--block' : ''
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button type="button" className={cls} onClick={onClick} title={title}>
      <span className="pad__label">{label}</span>
    </button>
  );
}
