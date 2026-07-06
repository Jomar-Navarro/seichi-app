export default function MainPage() {
	return (
		<>
			<div>
				<h1>MainPage</h1>
				<form action="/auth/signout" method="post">
					<button type="submit">Logout</button>
				</form>
			</div>
		</>
	);
}
