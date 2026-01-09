
import React from 'react';
import { Input } from './input';

const FormattedNumberInput = ({ value, onChange, placeholder, className, ...props }) => {
    // Display value derived directly from props
    const displayValue = (value === '' || value === undefined || value === null)
        ? ''
        : Number(value).toLocaleString('id-ID');

    const handleChange = (e) => {
        // 1. Get raw input
        const inputValue = e.target.value;

        // 2. Remove all non-digit characters
        const rawValue = inputValue.replace(/\D/g, '');

        // 3. Update external state with raw number
        if (rawValue === '') {
            onChange('');
        } else {
            onChange(Number(rawValue));
        }
    };

    return (
        <Input
            {...props}
            type="text" // Must be text to support separators
            value={displayValue}
            onChange={handleChange}
            placeholder={placeholder}
            className={className}
        />
    );
};

export default FormattedNumberInput;
