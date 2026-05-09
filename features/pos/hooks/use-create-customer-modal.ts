import { useCallback, useState } from "react";
import { useCreateCustomerMutation } from "./use-pos-queries";

export function useCreateCustomerModal(
	onCustomerCreated: (customerId: string) => void,
) {
	const [isCreateCustomerModalOpen, setIsCreateCustomerModalOpen] =
		useState(false);
	const [newCustomerName, setNewCustomerName] = useState("");
	const [newCustomerPhone, setNewCustomerPhone] = useState("");
	const [newCustomerDocumentType, setNewCustomerDocumentType] = useState("CC");
	const [newCustomerDocumentNumber, setNewCustomerDocumentNumber] =
		useState("");

	const createCustomerMutation = useCreateCustomerMutation();

	const handleCreateCustomer = useCallback(() => {
		if (!newCustomerName.trim()) {
			return;
		}

		createCustomerMutation.mutate(
			{
				name: newCustomerName.trim(),
				phone: newCustomerPhone.trim() || null,
				documentType: newCustomerDocumentNumber.trim()
					? newCustomerDocumentType
					: null,
				documentNumber: newCustomerDocumentNumber.trim() || null,
				type: null,
				email: null,
				address: null,
				city: null,
				taxRegime: null,
			},
			{
				onSuccess: (result) => {
					setIsCreateCustomerModalOpen(false);
					setNewCustomerName("");
					setNewCustomerPhone("");
					setNewCustomerDocumentType("CC");
					setNewCustomerDocumentNumber("");
					onCustomerCreated(result.id);
				},
			},
		);
	}, [
		newCustomerName,
		newCustomerPhone,
		newCustomerDocumentType,
		newCustomerDocumentNumber,
		createCustomerMutation,
		onCustomerCreated,
	]);

	const resetForm = useCallback(() => {
		setNewCustomerName("");
		setNewCustomerPhone("");
		setNewCustomerDocumentType("CC");
		setNewCustomerDocumentNumber("");
	}, []);

	const canCreateCustomer =
		newCustomerName.trim().length > 0 && !createCustomerMutation.isPending;

	return {
		// State
		isCreateCustomerModalOpen,
		setIsCreateCustomerModalOpen,
		newCustomerName,
		setNewCustomerName,
		newCustomerPhone,
		setNewCustomerPhone,
		newCustomerDocumentType,
		setNewCustomerDocumentType,
		newCustomerDocumentNumber,
		setNewCustomerDocumentNumber,

		// Actions
		canCreateCustomer,
		isCreating: createCustomerMutation.isPending,
		error: createCustomerMutation.error,
		handleCreateCustomer,
		resetForm,
	};
}
