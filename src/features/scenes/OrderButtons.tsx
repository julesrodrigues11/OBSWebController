import { useScenes } from '../../store/scenes'

/** ⤒ ▲ ▼ ⤓ buttons for an item's stacking order. Buttons that would do nothing are disabled. */
export function OrderButtons({ container, itemId }: { container: string; itemId: number }) {
  const siblings = useScenes((s) => s.items[container]) ?? []
  const moveItem = useScenes((s) => s.moveItem)
  const pos = siblings.findIndex((s) => s.id === itemId)
  const isTop = pos <= 0
  const isBottom = pos === siblings.length - 1
  const move = (to: 'top' | 'up' | 'down' | 'bottom') => void moveItem(container, itemId, to)

  return (
    <span className="item__order" aria-label="Order">
      <button className="order-button" disabled={isTop} onClick={() => move('top')} title="Move to top (drawn above everything)">⤒</button>
      <button className="order-button" disabled={isTop} onClick={() => move('up')} title="Move up">▲</button>
      <button className="order-button" disabled={isBottom} onClick={() => move('down')} title="Move down">▼</button>
      <button className="order-button" disabled={isBottom} onClick={() => move('bottom')} title="Move to bottom (drawn underneath everything)">⤓</button>
    </span>
  )
}
