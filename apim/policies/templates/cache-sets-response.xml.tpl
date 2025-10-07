<!-- Cache policy for /sets endpoint -->
<policies>
    <inbound>
        <cache-lookup vary-by-developer="false" vary-by-developer-groups="false" downstream-caching-type="none">
            <vary-by-query-parameter>language</vary-by-query-parameter>
            <vary-by-query-parameter>page</vary-by-query-parameter>
            <vary-by-query-parameter>pageSize</vary-by-query-parameter>
            <vary-by-query-parameter>all</vary-by-query-parameter>
        </cache-lookup>
    </inbound>
    <backend>
        <forward-request />
    </backend>
    <outbound>
        <cache-store duration="${cache_duration_sets}" />
    </outbound>
    <on-error />
</policies>
