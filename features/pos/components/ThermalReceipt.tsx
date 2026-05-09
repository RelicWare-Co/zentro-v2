import type { CSSProperties } from "react";

export type ThermalReceiptInfoLine = {
	label: string;
	value: string | null | undefined;
};

export type ThermalReceiptItem = {
	label: string;
	quantity?: number;
	unitPriceLabel?: string | null;
	totalLabel: string;
	secondaryLines?: string[];
};

export type ThermalReceiptPayment = {
	label: string;
	amountLabel: string;
	secondaryLines?: string[];
};

export type ThermalReceiptTotal = {
	label: string;
	value: string;
	emphasis?: boolean;
};

export type ThermalReceiptProps = {
	businessName?: string;
	title: string;
	documentLabel?: string;
	issuedAtLabel: string;
	statusLabel?: string;
	infoLines?: ThermalReceiptInfoLine[];
	items?: ThermalReceiptItem[];
	payments?: ThermalReceiptPayment[];
	totals: ThermalReceiptTotal[];
	footerLines?: string[];
};

export function ThermalReceipt({
	businessName = "Zentro",
	title,
	documentLabel,
	issuedAtLabel,
	statusLabel,
	infoLines,
	items = [],
	payments = [],
	totals,
	footerLines = ["Gracias por su compra"],
}: ThermalReceiptProps) {
	const visibleInfoLines = (infoLines ?? []).filter((line) =>
		Boolean(line.value),
	);

	return (
		<div style={styles.page}>
			<header style={styles.centeredSection}>
				<p style={styles.businessName}>{businessName}</p>
				<p style={styles.title}>{title}</p>
				{documentLabel ? <p style={styles.metaLine}>{documentLabel}</p> : null}
				<p style={styles.metaLine}>{issuedAtLabel}</p>
				{statusLabel ? <p style={styles.metaLine}>{statusLabel}</p> : null}
			</header>

			<Divider />

			{visibleInfoLines.length > 0 ? (
				<>
					<section style={styles.section}>
						{visibleInfoLines.map((line) => (
							<Row
								key={`${line.label}-${line.value}`}
								label={line.label}
								value={line.value ?? ""}
							/>
						))}
					</section>
					<Divider />
				</>
			) : null}

			{items.length > 0 ? (
				<>
					<section style={styles.section}>
						<p style={styles.sectionTitle}>DETALLE</p>
						<div style={styles.stack}>
							{items.map((item) => (
								<div
									key={[
										item.label,
										item.quantity ?? "",
										item.unitPriceLabel ?? "",
										item.totalLabel,
										item.secondaryLines?.join("|") ?? "",
									].join("-")}
									style={styles.itemBlock}
								>
									<div style={styles.itemHeader}>
										<div style={styles.itemTitleBlock}>
											<p style={styles.itemLabel}>
												{typeof item.quantity === "number"
												? `${item.quantity} x ${item.label}`
												: item.label}
											</p>
											{item.unitPriceLabel ? (
												<p style={styles.secondaryText}>
													{item.unitPriceLabel}
												</p>
											) : null}
										</div>
										<p style={styles.itemAmount}>{item.totalLabel}</p>
									</div>
									{item.secondaryLines?.length ? (
										<div style={styles.secondaryStack}>
											{item.secondaryLines.map((line) => (
												<p key={line} style={styles.secondaryText}>
													{line}
												</p>
											))}
										</div>
									) : null}
								</div>
							))}
						</div>
					</section>
					<Divider />
				</>
			) : null}

			{payments.length > 0 ? (
				<>
					<section style={styles.section}>
						<p style={styles.sectionTitle}>PAGOS</p>
						<div style={styles.stack}>
							{payments.map((payment) => (
								<div
									key={[
										payment.label,
										payment.amountLabel,
										payment.secondaryLines?.join("|") ?? "",
									].join("-")}
									style={styles.itemBlock}
								>
									<div style={styles.itemHeader}>
										<p style={styles.itemLabel}>{payment.label}</p>
										<p style={styles.itemAmount}>{payment.amountLabel}</p>
									</div>
									{payment.secondaryLines?.length ? (
										<div style={styles.secondaryStack}>
											{payment.secondaryLines.map((line) => (
												<p key={line} style={styles.secondaryText}>
													{line}
												</p>
											))}
										</div>
									) : null}
								</div>
							))}
						</div>
					</section>
					<Divider />
				</>
			) : null}

			<section style={styles.section}>
				<p style={styles.sectionTitle}>TOTALES</p>
				<div style={styles.stack}>
					{totals.map((total) => (
						<Row
							key={total.label}
							label={total.label}
							value={total.value}
							emphasis={total.emphasis}
						/>
					))}
				</div>
			</section>

			<Divider />

			<footer style={styles.centeredSection}>
				{footerLines.map((line) => (
					<p key={line} style={styles.footerLine}>
						{line}
					</p>
				))}
			</footer>
		</div>
	);
}

function Row({
	label,
	value,
	emphasis = false,
}: {
	label: string;
	value: string;
	emphasis?: boolean;
}) {
	return (
		<div style={styles.row}>
			<span style={emphasis ? styles.emphasisLabel : styles.label}>
				{label}
			</span>
			<span style={emphasis ? styles.emphasisValue : styles.value}>
				{value}
			</span>
		</div>
	);
}

function Divider() {
	return <div style={styles.divider}>--------------------------------</div>;
}

const styles = {
	page: {
		width: "72mm",
		margin: "0 auto",
		padding: "4mm 0",
		color: "#000",
		fontFamily:
			'"SFMono-Regular", ui-monospace, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
		fontSize: "11px",
		lineHeight: 1.35,
	} satisfies CSSProperties,
	centeredSection: {
		textAlign: "center",
	} satisfies CSSProperties,
	businessName: {
		margin: 0,
		fontSize: "16px",
		fontWeight: 700,
	} satisfies CSSProperties,
	title: {
		margin: "4px 0 0",
		fontSize: "13px",
		fontWeight: 700,
		textTransform: "uppercase",
	} satisfies CSSProperties,
	metaLine: {
		margin: "2px 0 0",
		whiteSpace: "pre-wrap",
	} satisfies CSSProperties,
	section: {
		display: "flex",
		flexDirection: "column",
		gap: "6px",
	} satisfies CSSProperties,
	sectionTitle: {
		margin: 0,
		fontWeight: 700,
		letterSpacing: "0.08em",
	} satisfies CSSProperties,
	stack: {
		display: "flex",
		flexDirection: "column",
		gap: "8px",
	} satisfies CSSProperties,
	row: {
		display: "flex",
		alignItems: "baseline",
		justifyContent: "space-between",
		gap: "8px",
	} satisfies CSSProperties,
	label: {
		margin: 0,
		flex: 1,
	} satisfies CSSProperties,
	value: {
		margin: 0,
		textAlign: "right",
		whiteSpace: "nowrap",
	} satisfies CSSProperties,
	emphasisLabel: {
		margin: 0,
		flex: 1,
		fontWeight: 700,
	} satisfies CSSProperties,
	emphasisValue: {
		margin: 0,
		textAlign: "right",
		whiteSpace: "nowrap",
		fontWeight: 700,
	} satisfies CSSProperties,
	itemBlock: {
		display: "flex",
		flexDirection: "column",
		gap: "2px",
	} satisfies CSSProperties,
	itemHeader: {
		display: "flex",
		alignItems: "flex-start",
		justifyContent: "space-between",
		gap: "8px",
	} satisfies CSSProperties,
	itemTitleBlock: {
		display: "flex",
		flexDirection: "column",
		gap: "2px",
		flex: 1,
		minWidth: 0,
	} satisfies CSSProperties,
	itemLabel: {
		margin: 0,
		fontWeight: 700,
		wordBreak: "break-word",
	} satisfies CSSProperties,
	itemAmount: {
		margin: 0,
		fontWeight: 700,
		whiteSpace: "nowrap",
	} satisfies CSSProperties,
	secondaryStack: {
		display: "flex",
		flexDirection: "column",
		gap: "1px",
		paddingLeft: "8px",
	} satisfies CSSProperties,
	secondaryText: {
		margin: 0,
		color: "#333",
		wordBreak: "break-word",
	} satisfies CSSProperties,
	divider: {
		margin: "8px 0",
		textAlign: "center",
		letterSpacing: "0.08em",
		whiteSpace: "nowrap",
		overflow: "hidden",
	} satisfies CSSProperties,
	footerLine: {
		margin: 0,
	} satisfies CSSProperties,
};
