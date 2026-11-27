import { useScenes } from '../../store/scenes'

/**
 * ⤒ ▲ ▼ ⤓ buttons for an item's stacking order. Buttons that would do nothing are disabled, and
 * all of them are when the item is locked.
 */
export function OrderButtons({ container, itemId, locked = false }: { container: string; itemId: number; locked?: boolean }) {
  const siblings = useScenes((s) => s.items[container]) ?? []
  const moveItem = useScenes((s) => s.moveItem)
  const pos = siblings.findIndex((s) => s.id === itemId)
  const isTop = locked || pos <= 0
  const isBottom = locked || pos === siblings.length - 1
  const move = (to: 'top' | 'up' | 'down' | 'bottom') => void moveItem(container, itemId, to)

  return (
    <span className="item__order" aria-label="Order" title={locked ? 'Locked: unlock to change its order' : undefined}>
      <button className="order-button" disabled={isTop} onClick={() => move('top')} title="Move to top (drawn above everything)">⤒</button>
      <button className="order-button" disabled={isTop} onClick={() => move('up')} title="Move up">▲</button>
      <button className="order-button" disabled={isBottom} onClick={() => move('down')} title="Move down">▼</button>
      <button className="order-button" disabled={isBottom} onClick={() => move('bottom')} title="Move to bottom (drawn underneath everything)">⤓</button>
    </span>
  )
}
