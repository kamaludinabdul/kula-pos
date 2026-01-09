import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";

const ConfirmDialog = ({ isOpen, onClose, onConfirm, title, description, message, confirmText = "Confirm", cancelText = "Cancel", variant = "destructive" }) => {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>
                        {description || message}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        {cancelText}
                    </Button>
                    <Button variant={variant} onClick={() => {
                        onConfirm();
                        onClose();
                    }}>
                        {confirmText}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ConfirmDialog;
