import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function Modal({ isOpen, onClose, title, children }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40"
          />
          {/* 弹窗 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md max-h-[90vh] overflow-auto bg-white dark:bg-[#1e1e2e] rounded-2xl shadow-2xl z-50"
          >
            {/* 头部 */}
            <div className="flex items-center justify-between p-4 border-b border-[#e5e4e7] dark:border-[#3a3a4c]">
              <h2 className="text-lg font-medium text-[#08060d] dark:text-[#f3f4f6]">
                {title}
              </h2>
              <button
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-[#f4f3f4] dark:hover:bg-[#2a2a3c] transition-colors"
              >
                <X size={20} className="text-[#6b6375]" />
              </button>
            </div>
            {/* 内容 */}
            <div className="p-4">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
