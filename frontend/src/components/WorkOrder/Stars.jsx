import { Star } from 'lucide-react';

export function Stars({ value, onChange, readonly }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onClick={() => !readonly && onChange?.(star)}
          disabled={readonly}
          className={`p-0.5 ${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'} transition-transform`}
        >
          <Star
            size={16}
            className={star <= value ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}
          />
        </button>
      ))}
    </div>
  );
}
