import { useEffect, useState } from 'react';
import { parseNumberDraft } from '@qsale/contracts';
import { Field } from './ui';

interface Props {
  label: string;
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  optional?: boolean;
  integer?: boolean;
  error?: string;
  hint?: string;
}

function displayNumber(value: Props['value']) {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
}

export function NumberField({
  value,
  onChange,
  optional = false,
  integer = false,
  ...props
}: Props) {
  const [draft, setDraft] = useState(() => displayNumber(value));

  useEffect(() => {
    // Keep in-progress input such as "", "40." and "40,5" until the user finishes editing.
    // A reset with a different saved value still updates the displayed text.
    if (!Object.is(value, parseNumberDraft(draft, optional))) setDraft(displayNumber(value));
  }, [value, optional]);

  return (
    <Field
      {...props}
      value={draft}
      keyboardType={integer ? 'number-pad' : 'decimal-pad'}
      onChangeText={(text) => {
        if (!/^[\d.,+\-]*$/.test(text)) return;
        setDraft(text);
        onChange(parseNumberDraft(text, optional));
      }}
    />
  );
}
