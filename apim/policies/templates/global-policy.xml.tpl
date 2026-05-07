<!--
  PCPC API global policy.

  CORS is implemented as a custom regex-based allowlist rather than the
  built-in <cors> element, because <cors>'s <allowed-origins> doesn't
  support wildcard subdomains and we need to allow Vercel preview URLs
  whose host segment varies per PR. See ADR-013 for the design rationale.

  The regex (`${cors_origin_regex}`) is assembled by Terraform from the
  glob-style patterns in var.cors_origin_patterns. Each request's Origin
  header is matched against it; matched origins are echoed back as
  Access-Control-Allow-Origin (both for preflight responses and for
  outbound headers on actual responses).

  Rate limiting is unchanged from the previous template.
-->
<policies>
    <inbound>
        <base />
        <!-- Resolve the request's Origin once and decide whether it matches the allowlist. -->
        <set-variable name="originHeader" value="@(context.Request.Headers.GetValueOrDefault(&quot;Origin&quot;, &quot;&quot;))" />
        <set-variable name="isOriginAllowed" value="@(((string)context.Variables[&quot;originHeader&quot;]).Length > 0 &amp;&amp; System.Text.RegularExpressions.Regex.IsMatch((string)context.Variables[&quot;originHeader&quot;], @&quot;${cors_origin_regex}&quot;))" />

        <!-- CORS preflight handler: short-circuit OPTIONS requests with the appropriate response. -->
        <choose>
            <when condition="@(context.Request.Method == &quot;OPTIONS&quot;)">
                <choose>
                    <when condition="@((bool)context.Variables[&quot;isOriginAllowed&quot;])">
                        <return-response>
                            <set-status code="204" reason="No Content" />
                            <set-header name="Access-Control-Allow-Origin" exists-action="override">
                                <value>@((string)context.Variables["originHeader"])</value>
                            </set-header>
                            <set-header name="Access-Control-Allow-Methods" exists-action="override">
                                <value>GET, OPTIONS</value>
                            </set-header>
                            <set-header name="Access-Control-Allow-Headers" exists-action="override">
                                <value>Content-Type, Ocp-Apim-Subscription-Key</value>
                            </set-header>
                            <set-header name="Access-Control-Max-Age" exists-action="override">
                                <value>86400</value>
                            </set-header>
                            <set-header name="Vary" exists-action="override">
                                <value>Origin</value>
                            </set-header>
                        </return-response>
                    </when>
                    <otherwise>
                        <return-response>
                            <set-status code="403" reason="Origin not allowed by CORS policy" />
                        </return-response>
                    </otherwise>
                </choose>
            </when>
        </choose>

        <!-- Rate limiting with environment-specific configuration -->
        <rate-limit calls="${rate_limit_calls}" renewal-period="${rate_limit_period}"
                   total-calls-header-name="X-RateLimit-Limit"
                   remaining-calls-header-name="X-RateLimit-Remaining"
                   remaining-calls-variable-name="remainingCalls" />
    </inbound>
    <backend>
        <forward-request />
    </backend>
    <outbound>
        <base />
        <!-- For non-preflight requests with an allowed Origin, add CORS response headers. -->
        <choose>
            <when condition="@((bool)context.Variables[&quot;isOriginAllowed&quot;])">
                <set-header name="Access-Control-Allow-Origin" exists-action="override">
                    <value>@((string)context.Variables["originHeader"])</value>
                </set-header>
                <set-header name="Vary" exists-action="override">
                    <value>Origin</value>
                </set-header>
                <set-header name="Access-Control-Expose-Headers" exists-action="override">
                    <value>X-RateLimit-Remaining</value>
                </set-header>
            </when>
        </choose>
    </outbound>
    <on-error>
        <base />
    </on-error>
</policies>
