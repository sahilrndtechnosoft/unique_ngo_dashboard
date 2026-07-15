import Swal from 'sweetalert2';

type AlertType = 'success' | 'error' | 'warning' | 'info';

export function showAlert(message: string, type: AlertType = 'success') {
    const toast = Swal.mixin({
        toast: true,
        position: 'top',
        showConfirmButton: false,
        timer: 3000,
        customClass: { container: 'toast' },
    });
    toast.fire({
        icon: type,
        title: message,
        padding: '10px 20px',
    });
}

export async function confirmAction(
    title: string,
    text = 'This action cannot be undone.',
    confirmButtonText = 'Yes, delete',
): Promise<boolean> {
    const result = await Swal.fire({
        icon: 'warning',
        title,
        text,
        showCancelButton: true,
        confirmButtonText,
        cancelButtonText: 'Cancel',
        reverseButtons: true,
        focusCancel: true,
        padding: '2em',
        customClass: {
            popup: 'sweet-alerts',
            actions: 'swal-actions-gap',
            confirmButton: 'btn btn-danger',
            cancelButton: 'btn btn-outline-primary',
        },
        buttonsStyling: false,
    });
    return result.isConfirmed;
}

export async function promptReason(title = 'Rejection reason'): Promise<string | null> {
    const result = await Swal.fire({
        title,
        input: 'text',
        inputPlaceholder: 'Enter reason',
        showCancelButton: true,
        confirmButtonText: 'Submit',
        cancelButtonText: 'Cancel',
        reverseButtons: true,
        inputValidator: (value) => (!value?.trim() ? 'Reason is required' : null),
        customClass: {
            popup: 'sweet-alerts',
            actions: 'swal-actions-gap',
            confirmButton: 'btn btn-primary',
            cancelButton: 'btn btn-outline-primary',
        },
        buttonsStyling: false,
    });
    if (!result.isConfirmed) return null;
    return String(result.value).trim();
}
