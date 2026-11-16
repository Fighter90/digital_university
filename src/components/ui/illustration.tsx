import Image from 'next/image';
import { cn } from 'cn';
import { ILLUSTRATIONS, type IllustrationName } from '@/lib/illustrations';

// DIG-16 — декоративная ИИ-иллюстрация через next/image. Все иллюстрации
// бренда не несут смысла (его дублирует соседний текст), поэтому alt="" и
// aria-hidden="true" зашиты здесь — вызовы не могут случайно сделать
// иллюстрацию значимой для скринридера.
export interface IllustrationProps {
  name: IllustrationName;
  className?: string;
  /** Приоритетная загрузка (LCP-картинки, напр. hero экрана входа). */
  priority?: boolean;
  sizes?: string;
}

export function Illustration({ name, className, priority, sizes }: IllustrationProps) {
  const illustration = ILLUSTRATIONS[name];
  return (
    <Image
      src={illustration.src}
      alt=""
      width={illustration.width}
      height={illustration.height}
      aria-hidden="true"
      priority={priority}
      sizes={sizes}
      draggable={false}
      className={cn('pointer-events-none size-auto select-none', className)}
    />
  );
}
