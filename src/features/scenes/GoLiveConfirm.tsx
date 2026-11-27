import { ConfirmStrip } from '../../components/ConfirmStrip'
import { useConnection } from '../../store/connection'

/** Show mode: switching the live scene asks first. */
export function GoLiveConfirm({ name, onDone }: { name: string; onDone: () => void }) {
  const goLive = useConnection((s) => s.goLive)
  const current = useConnection((s) => s.programScene)
  return (
    <ConfirmStrip
      message={<>Show mode: switch the live scene{current && <> from <strong>{current}</strong></>} to <strong>{name}</strong>?</>}
      actions={[{ label: 'Go live', onClick: () => void goLive(name) }]}
      onCancel={onDone}
    />
  )
}
