import { InputHTMLAttributes, useId, useState } from 'react';
import IconEye from '../Icon/IconEye';

export default function PasswordInput({ id, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
    const generatedId = useId();
    const inputId = id || generatedId;
    const [visible, setVisible] = useState(false);
    return (
        <div className="auth-password">
            <input {...props} id={inputId} type={visible ? 'text' : 'password'} />
            <button type="button" aria-label={visible ? 'Hide password' : 'Show password'} aria-controls={inputId} aria-pressed={visible} onClick={() => setVisible(value => !value)}>
                <IconEye className="auth-eye" duotone={false} /><span>{visible ? 'Hide' : 'Show'}</span>
            </button>
        </div>
    );
}
