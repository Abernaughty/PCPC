<script lang="ts">
	import '../app.css';
	import { BackendToggle } from '$lib/components';
	let { children } = $props();
</script>

{@render children()}

<BackendToggle />
