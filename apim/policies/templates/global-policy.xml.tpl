<policies>
    <inbound>
        <cors>
            <allowed-origins>
                {{#each cors_origins}}
                <origin>{{this}}</origin>
                {{/each}}
            </allowed-origins>
            <allowed-methods>
                <method>GET</method>
                <method>OPTIONS</method>
            </allowed-methods>
            <allowed-headers>
                <header>Content-Type</header>
                <header>Ocp-Apim-Subscription-Key</header>
            </allowed-headers>
            <expose-headers>
                <header>X-RateLimit-Remaining</header>
            </expose-headers>
        </cors>
        <!-- Rate limiting with environment-specific configuration -->
        <rate-limit calls="{{rate_limit_calls}}" renewal-period="{{rate_limit_period}}" 
                   remaining-calls-header-name="X-RateLimit-Remaining" 
                   remaining-calls-variable-name="remainingCalls" />
    </inbound>
    <backend>
        <forward-request />
    </backend>
    <outbound />
    <on-error />
</policies>
