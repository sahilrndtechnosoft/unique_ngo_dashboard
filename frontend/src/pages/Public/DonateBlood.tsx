import { FormEvent, useEffect, useState } from 'react';
import axios from 'axios';
import { api, getErrorMessage } from '../../services/api';

const BLOOD_GROUPS = ['A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE'];

const emptyForm = {
    accessToken: '',
    donationType: 'hospital' as 'hospital' | 'camp',
    hospitalId: '',
    campaignId: '',
    bloodGroup: '',
    donationDate: '',
    unitsDonated: '1',
    donationCenter: '',
    city: '',
    state: '',
    notes: '',
};

export default function DonateBlood() {
    const [form, setForm] = useState(emptyForm);
    const [file, setFile] = useState<File | null>(null);
    const [hospitals, setHospitals] = useState<any[]>([]);
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState<any>(null);

    useEffect(() => {
        api.get('/hospitals', { params: { limit: 100 } }).then((r) => setHospitals(r.data?.data?.items ?? []));
        api.get('/campaigns', { params: { limit: 100 } }).then((r) => setCampaigns(r.data?.data?.items ?? []));
    }, []);

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setError('');
        setSuccess(null);

        if (!form.accessToken.trim()) {
            setError('Your access token is required to submit a donation');
            return;
        }
        if (!file) {
            setError('A donation certificate / proof image is required');
            return;
        }

        const body = new FormData();
        body.append('file', file);
        body.append('bloodGroup', form.bloodGroup);
        body.append('donationDate', form.donationDate);
        body.append('unitsDonated', form.unitsDonated || '1');
        if (form.donationType === 'hospital' && form.hospitalId) body.append('hospitalId', form.hospitalId);
        if (form.donationType === 'camp' && form.campaignId) body.append('campaignId', form.campaignId);
        if (form.donationCenter) body.append('donationCenter', form.donationCenter);
        if (form.city) body.append('city', form.city);
        if (form.state) body.append('state', form.state);
        if (form.notes) body.append('notes', form.notes);

        setBusy(true);
        try {
            const response = await axios.post(`${api.defaults.baseURL}/donations`, body, {
                headers: {
                    Authorization: `Bearer ${form.accessToken.trim()}`,
                    'Content-Type': 'multipart/form-data',
                },
            });
            setSuccess(response.data?.data ?? response.data);
            setForm({ ...emptyForm, accessToken: form.accessToken });
            setFile(null);
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#fafafa] p-4 dark:bg-[#060818]">
            <div className="panel w-full max-w-2xl">
                <h1 className="mb-1 text-xl font-semibold dark:text-white-light">Submit a Blood Donation</h1>
                <p className="mb-6 text-sm text-white-dark">
                    Fill in your donation details and upload the certificate you received at the hospital or camp. It will be
                    reviewed by an admin before your reward is credited.
                </p>

                {error ? <div className="mb-4 rounded bg-danger-light p-3 text-danger">{error}</div> : null}
                {success ? (
                    <div className="mb-4 rounded bg-success-light p-3 text-success">
                        Donation submitted successfully and is pending review (status: {success.status}).
                    </div>
                ) : null}

                <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={submit}>
                    <div className="md:col-span-2">
                        <label className="mb-1 block text-sm font-semibold">Your Access Token</label>
                        <input
                            className="form-input"
                            required
                            placeholder="Paste your JWT access token"
                            value={form.accessToken}
                            onChange={(e) => setForm({ ...form, accessToken: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-semibold">Donated At</label>
                        <div className="flex items-center gap-4 h-[38px]">
                            <label className="flex items-center gap-2">
                                <input
                                    type="radio"
                                    checked={form.donationType === 'hospital'}
                                    onChange={() => setForm({ ...form, donationType: 'hospital', campaignId: '' })}
                                />
                                Hospital
                            </label>
                            <label className="flex items-center gap-2">
                                <input
                                    type="radio"
                                    checked={form.donationType === 'camp'}
                                    onChange={() => setForm({ ...form, donationType: 'camp', hospitalId: '' })}
                                />
                                Camp
                            </label>
                        </div>
                    </div>

                    {form.donationType === 'hospital' ? (
                        <div>
                            <label className="mb-1 block text-sm font-semibold">Hospital</label>
                            <select className="form-select" value={form.hospitalId} onChange={(e) => setForm({ ...form, hospitalId: e.target.value })}>
                                <option value="">Select hospital</option>
                                {hospitals.map((hospital) => (
                                    <option key={hospital.id} value={hospital.id}>
                                        {hospital.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    ) : (
                        <div>
                            <label className="mb-1 block text-sm font-semibold">Camp / Campaign</label>
                            <select className="form-select" value={form.campaignId} onChange={(e) => setForm({ ...form, campaignId: e.target.value })}>
                                <option value="">Select camp</option>
                                {campaigns.map((campaign) => (
                                    <option key={campaign.id} value={campaign.id}>
                                        {campaign.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div>
                        <label className="mb-1 block text-sm font-semibold">Blood Group</label>
                        <select className="form-select" required value={form.bloodGroup} onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })}>
                            <option value="">Select blood group</option>
                            {BLOOD_GROUPS.map((group) => (
                                <option key={group} value={group}>
                                    {group.replace('_', ' ')}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-semibold">Donation Date</label>
                        <input
                            className="form-input"
                            type="date"
                            required
                            value={form.donationDate}
                            onChange={(e) => setForm({ ...form, donationDate: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-semibold">Units Donated</label>
                        <input
                            className="form-input"
                            type="number"
                            min={0.5}
                            step={0.5}
                            value={form.unitsDonated}
                            onChange={(e) => setForm({ ...form, unitsDonated: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-semibold">Donation Center Name</label>
                        <input className="form-input" value={form.donationCenter} onChange={(e) => setForm({ ...form, donationCenter: e.target.value })} />
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-semibold">City</label>
                        <input className="form-input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-semibold">State</label>
                        <input className="form-input" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
                    </div>

                    <div className="md:col-span-2">
                        <label className="mb-1 block text-sm font-semibold">Notes</label>
                        <textarea className="form-textarea" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                    </div>

                    <div className="md:col-span-2">
                        <label className="mb-1 block text-sm font-semibold">Certificate / Proof Image</label>
                        <input
                            className="form-input"
                            type="file"
                            accept="image/*"
                            required
                            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                        />
                    </div>

                    <div className="md:col-span-2">
                        <button type="submit" className="btn btn-primary w-full" disabled={busy}>
                            {busy ? 'Submitting...' : 'Submit Donation'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
