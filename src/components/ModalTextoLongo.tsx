'use client';

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';

interface ModalTextoLongoProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    content: string;
}

export function ModalTextoLongo({ isOpen, onClose, title, content }: ModalTextoLongoProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden rounded-2xl">
                <DialogHeader>
                    <DialogTitle className="text-lg font-semibold text-slate-900">
                        {title}
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        Visualização completa do texto
                    </DialogDescription>
                </DialogHeader>
                <div className="mt-4 overflow-y-auto max-h-[60vh] pr-2">
                    <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                        {content}
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
}
