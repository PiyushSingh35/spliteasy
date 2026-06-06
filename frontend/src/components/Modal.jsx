/** Simple centered modal overlay. */
export default function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-30 px-4"
         onMouseDown={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
           onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
