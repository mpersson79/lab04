##  Performing an S2I (source to image) build within OpenShift

Clone this git repo to your local disk and then use that to create a publicly visible git rep on github.com (the public one, not the IBM enterprise git repo).
After this code is in the github.com repo, work through the task specified. Note that you will need the maven command line working locally, and
a locally installed Java 11 JDK, in order to make the first 3 steps of this exercise work. In order to make the maven command line work, you
will have to set the JAVA_HOME environment variable to point to the location of the JDK. If you cannot get this working, it is still possible
to complete the rest of this exercise (step 4 and onwards), but you will not have a reference working application to compare to.


## Task

1. Change directory to the "complete" sub-directory within the repo. Perform a maven build ("mvn package") and ensure that it completes successfully.

Installation and set up of Maven and the Java 11 JDK will differ depending on the operating system that you are using. The example shown below, uses Linux.
```
zaphod:s2i-builds-answer$ mvn --version
Apache Maven 3.5.4 (Red Hat 3.5.4-5)
Maven home: /usr/share/maven
Java version: 11.0.10, vendor: Red Hat, Inc., runtime: /usr/lib/jvm/java-11-openjdk-11.0.10.0.9-4.el8_3.x86_64
Default locale: en_US, platform encoding: UTF-8
OS name: "linux", version: "4.18.0-240.10.1.el8_3.x86_64", arch: "amd64", family: "unix"
zaphod:s2i-builds-answer$ echo $JAVA_HOME
/usr/lib/jvm/java-11-openjdk-11.0.10.0.9-4.el8_3.x86_64
zaphod:s2i-builds-answer$ /usr/lib/jvm/java-11-openjdk-11.0.10.0.9-4.el8_3.x86_64/bin/javac --version
javac 11.0.10
zaphod:s2i-builds-answer$ cd complete
zaphod:complete$ mvn clean package
[INFO] Scanning for projects...
[INFO] 
[INFO] ----------------------< com.example:spring-boot >-----------------------
[INFO] Building spring-boot 0.0.1-SNAPSHOT
[INFO] --------------------------------[ jar ]---------------------------------
[INFO] 
[INFO] --- maven-clean-plugin:3.1.0:clean (default-clean) @ spring-boot ---
[INFO] Deleting /home/zaphod/code/sa-bootcamp/s2i-builds-answer/complete/target
[INFO] 
[INFO] --- maven-resources-plugin:3.2.0:resources (default-resources) @ spring-boot ---
[INFO] Using 'UTF-8' encoding to copy filtered resources.
[INFO] Using 'UTF-8' encoding to copy filtered properties files.
[INFO] skip non existing resourceDirectory /home/zaphod/code/sa-bootcamp/s2i-builds-answer/complete/src/main/resources
[INFO] skip non existing resourceDirectory /home/zaphod/code/sa-bootcamp/s2i-builds-answer/complete/src/main/resources
[INFO] 
[INFO] --- maven-compiler-plugin:3.8.1:compile (default-compile) @ spring-boot ---
[INFO] Changes detected - recompiling the module!
[INFO] Compiling 2 source files to /home/zaphod/code/sa-bootcamp/s2i-builds-answer/complete/target/classes
[INFO] 
[INFO] --- maven-resources-plugin:3.2.0:testResources (default-testResources) @ spring-boot ---
[INFO] Using 'UTF-8' encoding to copy filtered resources.
[INFO] Using 'UTF-8' encoding to copy filtered properties files.
[INFO] skip non existing resourceDirectory /home/zaphod/code/sa-bootcamp/s2i-builds-answer/complete/src/test/resources
[INFO] 
[INFO] --- maven-compiler-plugin:3.8.1:testCompile (default-testCompile) @ spring-boot ---
[INFO] Changes detected - recompiling the module!
[INFO] Compiling 2 source files to /home/zaphod/code/sa-bootcamp/s2i-builds-answer/complete/target/test-classes
[INFO] 
[INFO] --- maven-surefire-plugin:2.22.2:test (default-test) @ spring-boot ---
[INFO] 
[INFO] -------------------------------------------------------
[INFO]  T E S T S
[INFO] -------------------------------------------------------
[INFO] Running com.example.springboot.HelloControllerTest
20:22:32.311 [main] DEBUG org.springframework.test.context.BootstrapUtils - Instantiating CacheAwareContextLoaderDelegate from class [org.springframework.test.context.cache.DefaultCacheAwareContextLoaderDelegate]
20:22:32.320 [main] DEBUG org.springframework.test.context.BootstrapUtils - Instantiating BootstrapContext using constructor [public org.springframework.test.context.support.DefaultBootstrapContext(java.lang.Class,org.springframework.test.context.CacheAwareContextLoaderDelegate)]
20:22:32.346 [main] DEBUG org.springframework.test.context.BootstrapUtils - Instantiating TestContextBootstrapper for test class [com.example.springboot.HelloControllerTest] from class [org.springframework.boot.test.context.SpringBootTestContextBootstrapper]
20:22:32.353 [main] INFO org.springframework.boot.test.context.SpringBootTestContextBootstrapper - Neither @ContextConfiguration nor @ContextHierarchy found for test class [com.example.springboot.HelloControllerTest], using SpringBootContextLoader
20:22:32.356 [main] DEBUG org.springframework.test.context.support.AbstractContextLoader - Did not detect default resource location for test class [com.example.springboot.HelloControllerTest]: class path resource [com/example/springboot/HelloControllerTest-context.xml] does not exist
20:22:32.356 [main] DEBUG org.springframework.test.context.support.AbstractContextLoader - Did not detect default resource location for test class [com.example.springboot.HelloControllerTest]: class path resource [com/example/springboot/HelloControllerTestContext.groovy] does not exist
20:22:32.356 [main] INFO org.springframework.test.context.support.AbstractContextLoader - Could not detect default resource locations for test class [com.example.springboot.HelloControllerTest]: no resource found for suffixes {-context.xml, Context.groovy}.
20:22:32.357 [main] INFO org.springframework.test.context.support.AnnotationConfigContextLoaderUtils - Could not detect default configuration classes for test class [com.example.springboot.HelloControllerTest]: HelloControllerTest does not declare any static, non-private, non-final, nested classes annotated with @Configuration.
20:22:32.388 [main] DEBUG org.springframework.test.context.support.ActiveProfilesUtils - Could not find an 'annotation declaring class' for annotation type [org.springframework.test.context.ActiveProfiles] and class [com.example.springboot.HelloControllerTest]
20:22:32.420 [main] DEBUG org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider - Identified candidate component class: file [/home/zaphod/code/sa-bootcamp/s2i-builds-answer/complete/target/classes/com/example/springboot/Application.class]
20:22:32.426 [main] INFO org.springframework.boot.test.context.SpringBootTestContextBootstrapper - Found @SpringBootConfiguration com.example.springboot.Application for test class com.example.springboot.HelloControllerTest
20:22:32.481 [main] DEBUG org.springframework.boot.test.context.SpringBootTestContextBootstrapper - @TestExecutionListeners is not present for class [com.example.springboot.HelloControllerTest]: using defaults.
20:22:32.481 [main] INFO org.springframework.boot.test.context.SpringBootTestContextBootstrapper - Loaded default TestExecutionListener class names from location [META-INF/spring.factories]: [org.springframework.boot.test.mock.mockito.MockitoTestExecutionListener, org.springframework.boot.test.mock.mockito.ResetMocksTestExecutionListener, org.springframework.boot.test.autoconfigure.restdocs.RestDocsTestExecutionListener, org.springframework.boot.test.autoconfigure.web.client.MockRestServiceServerResetTestExecutionListener, org.springframework.boot.test.autoconfigure.web.servlet.MockMvcPrintOnlyOnFailureTestExecutionListener, org.springframework.boot.test.autoconfigure.web.servlet.WebDriverTestExecutionListener, org.springframework.boot.test.autoconfigure.webservices.client.MockWebServiceServerTestExecutionListener, org.springframework.test.context.web.ServletTestExecutionListener, org.springframework.test.context.support.DirtiesContextBeforeModesTestExecutionListener, org.springframework.test.context.event.ApplicationEventsTestExecutionListener, org.springframework.test.context.support.DependencyInjectionTestExecutionListener, org.springframework.test.context.support.DirtiesContextTestExecutionListener, org.springframework.test.context.transaction.TransactionalTestExecutionListener, org.springframework.test.context.jdbc.SqlScriptsTestExecutionListener, org.springframework.test.context.event.EventPublishingTestExecutionListener]
20:22:32.488 [main] DEBUG org.springframework.boot.test.context.SpringBootTestContextBootstrapper - Skipping candidate TestExecutionListener [org.springframework.test.context.transaction.TransactionalTestExecutionListener] due to a missing dependency. Specify custom listener classes or make the default listener classes and their required dependencies available. Offending class: [org/springframework/transaction/interceptor/TransactionAttributeSource]
20:22:32.488 [main] DEBUG org.springframework.boot.test.context.SpringBootTestContextBootstrapper - Skipping candidate TestExecutionListener [org.springframework.test.context.jdbc.SqlScriptsTestExecutionListener] due to a missing dependency. Specify custom listener classes or make the default listener classes and their required dependencies available. Offending class: [org/springframework/transaction/interceptor/TransactionAttribute]
20:22:32.488 [main] INFO org.springframework.boot.test.context.SpringBootTestContextBootstrapper - Using TestExecutionListeners: [org.springframework.test.context.web.ServletTestExecutionListener@3c01cfa1, org.springframework.test.context.support.DirtiesContextBeforeModesTestExecutionListener@45d2ade3, org.springframework.test.context.event.ApplicationEventsTestExecutionListener@727eb8cb, org.springframework.boot.test.mock.mockito.MockitoTestExecutionListener@39d9314d, org.springframework.boot.test.autoconfigure.SpringBootDependencyInjectionTestExecutionListener@b978d10, org.springframework.test.context.support.DirtiesContextTestExecutionListener@5b7a8434, org.springframework.test.context.event.EventPublishingTestExecutionListener@5c45d770, org.springframework.boot.test.mock.mockito.ResetMocksTestExecutionListener@2ce6c6ec, org.springframework.boot.test.autoconfigure.restdocs.RestDocsTestExecutionListener@1bae316d, org.springframework.boot.test.autoconfigure.web.client.MockRestServiceServerResetTestExecutionListener@147a5d08, org.springframework.boot.test.autoconfigure.web.servlet.MockMvcPrintOnlyOnFailureTestExecutionListener@6676f6a0, org.springframework.boot.test.autoconfigure.web.servlet.WebDriverTestExecutionListener@7cbd9d24, org.springframework.boot.test.autoconfigure.webservices.client.MockWebServiceServerTestExecutionListener@1672fe87]
20:22:32.490 [main] DEBUG org.springframework.test.context.support.AbstractDirtiesContextTestExecutionListener - Before test class: context [DefaultTestContext@6057aebb testClass = HelloControllerTest, testInstance = [null], testMethod = [null], testException = [null], mergedContextConfiguration = [WebMergedContextConfiguration@63eef88a testClass = HelloControllerTest, locations = '{}', classes = '{class com.example.springboot.Application}', contextInitializerClasses = '[]', activeProfiles = '{}', propertySourceLocations = '{}', propertySourceProperties = '{org.springframework.boot.test.context.SpringBootTestContextBootstrapper=true}', contextCustomizers = set[[ImportsContextCustomizer@53251a66 key = [org.springframework.boot.test.autoconfigure.web.servlet.MockMvcAutoConfiguration, org.springframework.boot.test.autoconfigure.web.servlet.MockMvcWebClientAutoConfiguration, org.springframework.boot.test.autoconfigure.web.servlet.MockMvcWebDriverAutoConfiguration, org.springframework.boot.autoconfigure.security.oauth2.client.servlet.OAuth2ClientAutoConfiguration, org.springframework.boot.autoconfigure.security.oauth2.resource.servlet.OAuth2ResourceServerAutoConfiguration, org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration, org.springframework.boot.autoconfigure.security.servlet.SecurityFilterAutoConfiguration, org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration, org.springframework.boot.test.autoconfigure.web.servlet.MockMvcSecurityConfiguration]], org.springframework.boot.test.context.filter.ExcludeFilterContextCustomizer@49dc7102, org.springframework.boot.test.json.DuplicateJsonObjectContextCustomizerFactory$DuplicateJsonObjectContextCustomizer@10959ece, org.springframework.boot.test.mock.mockito.MockitoContextCustomizer@0, org.springframework.boot.test.web.client.TestRestTemplateContextCustomizer@2f8dad04, org.springframework.boot.test.autoconfigure.actuate.metrics.MetricsExportContextCustomizerFactory$DisableMetricExportContextCustomizer@120f102b, org.springframework.boot.test.autoconfigure.properties.PropertyMappingContextCustomizer@4b3fa0b3, org.springframework.boot.test.autoconfigure.web.servlet.WebDriverContextCustomizerFactory$Customizer@5f9b2141, org.springframework.boot.test.context.SpringBootTestArgs@1, org.springframework.boot.test.context.SpringBootTestWebEnvironment@3cef309d], resourceBasePath = 'src/main/webapp', contextLoader = 'org.springframework.boot.test.context.SpringBootContextLoader', parent = [null]], attributes = map['org.springframework.test.context.web.ServletTestExecutionListener.activateListener' -> true]], class annotated with @DirtiesContext [false] with mode [null].
20:22:32.508 [main] DEBUG org.springframework.test.context.support.TestPropertySourceUtils - Adding inlined properties to environment: {spring.jmx.enabled=false, org.springframework.boot.test.context.SpringBootTestContextBootstrapper=true}

  .   ____          _            __ _ _
 /\\ / ___'_ __ _ _(_)_ __  __ _ \ \ \ \
( ( )\___ | '_ | '_| | '_ \/ _` | \ \ \ \
 \\/  ___)| |_)| | | | | || (_| |  ) ) ) )
  '  |____| .__|_| |_|_| |_\__, | / / / /
 =========|_|==============|___/=/_/_/_/
 :: Spring Boot ::                (v2.4.2)

2021-02-28 20:22:32.676  INFO 249921 --- [           main] c.e.springboot.HelloControllerTest       : Starting HelloControllerTest using Java 11.0.10 on li-ae8e55cc-22b6-11b2-a85c-fa062b02207f.ibm.com with PID 249921 (started by zaphod in /home/zaphod/code/sa-bootcamp/s2i-builds-answer/complete)
2021-02-28 20:22:32.679  INFO 249921 --- [           main] c.e.springboot.HelloControllerTest       : No active profile set, falling back to default profiles: default
2021-02-28 20:22:33.656  INFO 249921 --- [           main] o.s.s.concurrent.ThreadPoolTaskExecutor  : Initializing ExecutorService 'applicationTaskExecutor'
2021-02-28 20:22:33.967  INFO 249921 --- [           main] o.s.b.t.m.w.SpringBootMockServletContext : Initializing Spring TestDispatcherServlet ''
2021-02-28 20:22:33.967  INFO 249921 --- [           main] o.s.t.web.servlet.TestDispatcherServlet  : Initializing Servlet ''
2021-02-28 20:22:33.973  INFO 249921 --- [           main] o.s.b.a.e.web.EndpointLinksResolver      : Exposing 2 endpoint(s) beneath base path '/actuator'
2021-02-28 20:22:33.988  INFO 249921 --- [           main] o.s.t.web.servlet.TestDispatcherServlet  : Completed initialization in 21 ms
2021-02-28 20:22:34.012  INFO 249921 --- [           main] c.e.springboot.HelloControllerTest       : Started HelloControllerTest in 1.5 seconds (JVM running for 2.054)
Let's inspect the beans provided by Spring Boot:
application
applicationAvailability
applicationTaskExecutor
basicErrorController
beanNameHandlerMapping
beanNameViewResolver
characterEncodingFilter
classLoaderMetrics
commandLineRunner
controllerEndpointDiscoverer
controllerEndpointHandlerMapping
controllerExposeExcludePropertyEndpointFilter
conventionErrorViewResolver
defaultServletHandlerMapping
defaultViewResolver
diskSpaceHealthIndicator
dispatcherServlet
dispatcherServletMappingDescriptionProvider
dispatcherServletRegistration
endpointCachingOperationInvokerAdvisor
endpointMediaTypes
endpointOperationParameterMapper
envInfoContributor
error
errorAttributes
errorPageCustomizer
errorPageRegistrarBeanPostProcessor
fileDescriptorMetrics
filterMappingDescriptionProvider
flashMapManager
formContentFilter
handlerExceptionResolver
handlerFunctionAdapter
healthContributorRegistry
healthEndpoint
healthEndpointGroups
healthEndpointGroupsBeanPostProcessor
healthEndpointWebExtension
healthHttpCodeStatusMapper
healthStatusAggregator
helloController
httpRequestHandlerAdapter
infoEndpoint
jacksonObjectMapper
jacksonObjectMapperBuilder
jsonComponentModule
jvmGcMetrics
jvmMemoryMetrics
jvmThreadMetrics
lifecycleProcessor
localeCharsetMappingsCustomizer
localeResolver
logbackMetrics
management.endpoint.health-org.springframework.boot.actuate.autoconfigure.health.HealthEndpointProperties
management.endpoints.web-org.springframework.boot.actuate.autoconfigure.endpoint.web.WebEndpointProperties
management.endpoints.web.cors-org.springframework.boot.actuate.autoconfigure.endpoint.web.CorsEndpointProperties
management.health.diskspace-org.springframework.boot.actuate.autoconfigure.system.DiskSpaceHealthIndicatorProperties
management.info-org.springframework.boot.actuate.autoconfigure.info.InfoContributorProperties
management.metrics-org.springframework.boot.actuate.autoconfigure.metrics.MetricsProperties
management.metrics.export.simple-org.springframework.boot.actuate.autoconfigure.metrics.export.simple.SimpleProperties
management.server-org.springframework.boot.actuate.autoconfigure.web.server.ManagementServerProperties
managementServletContext
mappingJackson2HttpMessageConverter
messageConverters
meterRegistryPostProcessor
metricsHttpClientUriTagFilter
metricsHttpServerUriTagFilter
metricsRestTemplateCustomizer
metricsWebMvcConfigurer
micrometerClock
mockMvc
mockMvcBuilder
multipartConfigElement
multipartResolver
mvcContentNegotiationManager
mvcConversionService
mvcHandlerMappingIntrospector
mvcPathMatcher
mvcResourceUrlProvider
mvcUriComponentsContributor
mvcUrlPathHelper
mvcValidator
mvcViewResolver
org.springframework.aop.config.internalAutoProxyCreator
org.springframework.boot.actuate.autoconfigure.availability.AvailabilityHealthContributorAutoConfiguration
org.springframework.boot.actuate.autoconfigure.endpoint.EndpointAutoConfiguration
org.springframework.boot.actuate.autoconfigure.endpoint.web.ServletEndpointManagementContextConfiguration
org.springframework.boot.actuate.autoconfigure.endpoint.web.ServletEndpointManagementContextConfiguration$WebMvcServletEndpointManagementContextConfiguration
org.springframework.boot.actuate.autoconfigure.endpoint.web.WebEndpointAutoConfiguration
org.springframework.boot.actuate.autoconfigure.endpoint.web.WebEndpointAutoConfiguration$WebEndpointServletConfiguration
org.springframework.boot.actuate.autoconfigure.endpoint.web.servlet.WebMvcEndpointManagementContextConfiguration
org.springframework.boot.actuate.autoconfigure.health.HealthContributorAutoConfiguration
org.springframework.boot.actuate.autoconfigure.health.HealthEndpointAutoConfiguration
org.springframework.boot.actuate.autoconfigure.health.HealthEndpointConfiguration
org.springframework.boot.actuate.autoconfigure.health.HealthEndpointWebExtensionConfiguration
org.springframework.boot.actuate.autoconfigure.info.InfoContributorAutoConfiguration
org.springframework.boot.actuate.autoconfigure.info.InfoEndpointAutoConfiguration
org.springframework.boot.actuate.autoconfigure.metrics.CompositeMeterRegistryAutoConfiguration
org.springframework.boot.actuate.autoconfigure.metrics.JvmMetricsAutoConfiguration
org.springframework.boot.actuate.autoconfigure.metrics.LogbackMetricsAutoConfiguration
org.springframework.boot.actuate.autoconfigure.metrics.MetricsAutoConfiguration
org.springframework.boot.actuate.autoconfigure.metrics.SystemMetricsAutoConfiguration
org.springframework.boot.actuate.autoconfigure.metrics.export.simple.SimpleMetricsExportAutoConfiguration
org.springframework.boot.actuate.autoconfigure.metrics.integration.IntegrationMetricsAutoConfiguration
org.springframework.boot.actuate.autoconfigure.metrics.web.client.HttpClientMetricsAutoConfiguration
org.springframework.boot.actuate.autoconfigure.metrics.web.client.RestTemplateMetricsConfiguration
org.springframework.boot.actuate.autoconfigure.metrics.web.servlet.WebMvcMetricsAutoConfiguration
org.springframework.boot.actuate.autoconfigure.metrics.web.tomcat.TomcatMetricsAutoConfiguration
org.springframework.boot.actuate.autoconfigure.system.DiskSpaceHealthContributorAutoConfiguration
org.springframework.boot.actuate.autoconfigure.web.mappings.MappingsEndpointAutoConfiguration
org.springframework.boot.actuate.autoconfigure.web.mappings.MappingsEndpointAutoConfiguration$ServletWebConfiguration
org.springframework.boot.actuate.autoconfigure.web.mappings.MappingsEndpointAutoConfiguration$ServletWebConfiguration$SpringMvcConfiguration
org.springframework.boot.actuate.autoconfigure.web.server.ManagementContextAutoConfiguration
org.springframework.boot.actuate.autoconfigure.web.server.ManagementContextAutoConfiguration$SameManagementContextConfiguration
org.springframework.boot.actuate.autoconfigure.web.server.ManagementContextAutoConfiguration$SameManagementContextConfiguration$EnableSameManagementContextConfiguration
org.springframework.boot.actuate.autoconfigure.web.servlet.ServletManagementContextAutoConfiguration
org.springframework.boot.autoconfigure.AutoConfigurationPackages
org.springframework.boot.autoconfigure.aop.AopAutoConfiguration
org.springframework.boot.autoconfigure.aop.AopAutoConfiguration$ClassProxyingConfiguration
org.springframework.boot.autoconfigure.availability.ApplicationAvailabilityAutoConfiguration
org.springframework.boot.autoconfigure.context.ConfigurationPropertiesAutoConfiguration
org.springframework.boot.autoconfigure.context.LifecycleAutoConfiguration
org.springframework.boot.autoconfigure.context.PropertyPlaceholderAutoConfiguration
org.springframework.boot.autoconfigure.http.HttpMessageConvertersAutoConfiguration
org.springframework.boot.autoconfigure.http.HttpMessageConvertersAutoConfiguration$StringHttpMessageConverterConfiguration
org.springframework.boot.autoconfigure.http.JacksonHttpMessageConvertersConfiguration
org.springframework.boot.autoconfigure.http.JacksonHttpMessageConvertersConfiguration$MappingJackson2HttpMessageConverterConfiguration
org.springframework.boot.autoconfigure.info.ProjectInfoAutoConfiguration
org.springframework.boot.autoconfigure.internalCachingMetadataReaderFactory
org.springframework.boot.autoconfigure.jackson.JacksonAutoConfiguration
org.springframework.boot.autoconfigure.jackson.JacksonAutoConfiguration$Jackson2ObjectMapperBuilderCustomizerConfiguration
org.springframework.boot.autoconfigure.jackson.JacksonAutoConfiguration$JacksonObjectMapperBuilderConfiguration
org.springframework.boot.autoconfigure.jackson.JacksonAutoConfiguration$JacksonObjectMapperConfiguration
org.springframework.boot.autoconfigure.jackson.JacksonAutoConfiguration$ParameterNamesModuleConfiguration
org.springframework.boot.autoconfigure.task.TaskExecutionAutoConfiguration
org.springframework.boot.autoconfigure.task.TaskSchedulingAutoConfiguration
org.springframework.boot.autoconfigure.web.client.RestTemplateAutoConfiguration
org.springframework.boot.autoconfigure.web.embedded.EmbeddedWebServerFactoryCustomizerAutoConfiguration
org.springframework.boot.autoconfigure.web.embedded.EmbeddedWebServerFactoryCustomizerAutoConfiguration$TomcatWebServerFactoryCustomizerConfiguration
org.springframework.boot.autoconfigure.web.servlet.DispatcherServletAutoConfiguration
org.springframework.boot.autoconfigure.web.servlet.DispatcherServletAutoConfiguration$DispatcherServletConfiguration
org.springframework.boot.autoconfigure.web.servlet.DispatcherServletAutoConfiguration$DispatcherServletRegistrationConfiguration
org.springframework.boot.autoconfigure.web.servlet.HttpEncodingAutoConfiguration
org.springframework.boot.autoconfigure.web.servlet.MultipartAutoConfiguration
org.springframework.boot.autoconfigure.web.servlet.ServletWebServerFactoryAutoConfiguration
org.springframework.boot.autoconfigure.web.servlet.ServletWebServerFactoryConfiguration$EmbeddedTomcat
org.springframework.boot.autoconfigure.web.servlet.WebMvcAutoConfiguration
org.springframework.boot.autoconfigure.web.servlet.WebMvcAutoConfiguration$EnableWebMvcConfiguration
org.springframework.boot.autoconfigure.web.servlet.WebMvcAutoConfiguration$WebMvcAutoConfigurationAdapter
org.springframework.boot.autoconfigure.web.servlet.error.ErrorMvcAutoConfiguration
org.springframework.boot.autoconfigure.web.servlet.error.ErrorMvcAutoConfiguration$DefaultErrorViewResolverConfiguration
org.springframework.boot.autoconfigure.web.servlet.error.ErrorMvcAutoConfiguration$WhitelabelErrorViewConfiguration
org.springframework.boot.autoconfigure.websocket.servlet.WebSocketServletAutoConfiguration
org.springframework.boot.autoconfigure.websocket.servlet.WebSocketServletAutoConfiguration$TomcatWebSocketConfiguration
org.springframework.boot.context.internalConfigurationPropertiesBinder
org.springframework.boot.context.internalConfigurationPropertiesBinderFactory
org.springframework.boot.context.properties.BoundConfigurationProperties
org.springframework.boot.context.properties.ConfigurationPropertiesBindingPostProcessor
org.springframework.boot.context.properties.EnableConfigurationPropertiesRegistrar.methodValidationExcludeFilter
org.springframework.boot.test.autoconfigure.web.servlet.MockMvcAutoConfiguration
org.springframework.boot.test.context.ImportsContextCustomizer$ImportsCleanupPostProcessor
org.springframework.boot.test.mock.mockito.MockitoPostProcessor
org.springframework.boot.test.mock.mockito.MockitoPostProcessor$SpyPostProcessor
org.springframework.context.annotation.internalAutowiredAnnotationProcessor
org.springframework.context.annotation.internalCommonAnnotationProcessor
org.springframework.context.annotation.internalConfigurationAnnotationProcessor
org.springframework.context.event.internalEventListenerFactory
org.springframework.context.event.internalEventListenerProcessor
parameterNamesModule
pathMappedEndpoints
pingHealthContributor
preserveErrorControllerTargetClassPostProcessor
processorMetrics
propertiesMeterFilter
propertySourcesPlaceholderConfigurer
requestContextFilter
requestMappingHandlerAdapter
requestMappingHandlerMapping
resourceHandlerMapping
restTemplateBuilder
restTemplateBuilderConfigurer
restTemplateExchangeTagsProvider
routerFunctionMapping
server-org.springframework.boot.autoconfigure.web.ServerProperties
servletEndpointDiscoverer
servletEndpointRegistrar
servletExposeExcludePropertyEndpointFilter
servletMappingDescriptionProvider
servletWebChildContextFactory
servletWebServerFactoryCustomizer
simpleConfig
simpleControllerHandlerAdapter
simpleMeterRegistry
spring.info-org.springframework.boot.autoconfigure.info.ProjectInfoProperties
spring.jackson-org.springframework.boot.autoconfigure.jackson.JacksonProperties
spring.lifecycle-org.springframework.boot.autoconfigure.context.LifecycleProperties
spring.mvc-org.springframework.boot.autoconfigure.web.servlet.WebMvcProperties
spring.resources-org.springframework.boot.autoconfigure.web.ResourceProperties
spring.servlet.multipart-org.springframework.boot.autoconfigure.web.servlet.MultipartProperties
spring.task.execution-org.springframework.boot.autoconfigure.task.TaskExecutionProperties
spring.task.scheduling-org.springframework.boot.autoconfigure.task.TaskSchedulingProperties
spring.web-org.springframework.boot.autoconfigure.web.WebProperties
springBootMockMvcBuilderCustomizer
standardJacksonObjectMapperBuilderCustomizer
stringHttpMessageConverter
taskExecutorBuilder
taskSchedulerBuilder
themeResolver
tomcatMetricsBinder
tomcatServletWebServerFactory
tomcatServletWebServerFactoryCustomizer
tomcatWebServerFactoryCustomizer
uptimeMetrics
viewControllerHandlerMapping
viewNameTranslator
viewResolver
webEndpointDiscoverer
webEndpointPathMapper
webEndpointServletHandlerMapping
webExposeExcludePropertyEndpointFilter
webMvcMetricsFilter
webMvcTagsProvider
webServerFactoryCustomizerBeanPostProcessor
websocketServletWebServerCustomizer
welcomePageHandlerMapping
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 2.041 s - in com.example.springboot.HelloControllerTest
2021-02-28 20:22:34.320  INFO 249921 --- [extShutdownHook] o.s.s.concurrent.ThreadPoolTaskExecutor  : Shutting down ExecutorService 'applicationTaskExecutor'
[INFO] 
[INFO] Results:
[INFO] 
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0
[INFO] 
[INFO] 
[INFO] --- maven-jar-plugin:3.2.0:jar (default-jar) @ spring-boot ---
[INFO] Building jar: /home/zaphod/code/sa-bootcamp/s2i-builds-answer/complete/target/spring-boot-0.0.1-SNAPSHOT.jar
[INFO] 
[INFO] --- spring-boot-maven-plugin:2.4.2:repackage (repackage) @ spring-boot ---
[INFO] Replacing main artifact with repackaged archive
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] Total time: 4.746 s
[INFO] Finished at: 2021-02-28T20:22:34-05:00
[INFO] ------------------------------------------------------------------------
zaphod:complete$
```

2. Start the spring boot app. In the "target" sub-directory, you will find a <code>spring-boot-0.0.1-SNAPSHOT.jar</code> jar file. Use a java 11 JRE to start this Spring Boot application.
```
zaphod:complete$ ls target
classes            generated-test-sources  maven-status                    spring-boot-0.0.1-SNAPSHOT.jar.original  test-classes
generated-sources  maven-archiver          spring-boot-0.0.1-SNAPSHOT.jar  surefire-reports
zaphod:complete$ $JAVA_HOME/bin/java -jar target/spring-boot-0.0.1-SNAPSHOT.jar

  .   ____          _            __ _ _
 /\\ / ___'_ __ _ _(_)_ __  __ _ \ \ \ \
( ( )\___ | '_ | '_| | '_ \/ _` | \ \ \ \
 \\/  ___)| |_)| | | | | || (_| |  ) ) ) )
  '  |____| .__|_| |_|_| |_\__, | / / / /
 =========|_|==============|___/=/_/_/_/
 :: Spring Boot ::                (v2.4.2)

2021-02-28 20:26:17.531  INFO 250193 --- [           main] com.example.springboot.Application       : Starting Application v0.0.1-SNAPSHOT using Java 11.0.10 on li-ae8e55cc-22b6-11b2-a85c-fa062b02207f.ibm.com with PID 250193 (/home/zaphod/code/sa-bootcamp/s2i-builds-answer/complete/target/spring-boot-0.0.1-SNAPSHOT.jar started by zaphod in /home/zaphod/code/sa-bootcamp/s2i-builds-answer/complete)
2021-02-28 20:26:17.533  INFO 250193 --- [           main] com.example.springboot.Application       : No active profile set, falling back to default profiles: default
2021-02-28 20:26:18.443  INFO 250193 --- [           main] o.s.b.w.embedded.tomcat.TomcatWebServer  : Tomcat initialized with port(s): 8080 (http)
2021-02-28 20:26:18.452  INFO 250193 --- [           main] o.apache.catalina.core.StandardService   : Starting service [Tomcat]
2021-02-28 20:26:18.452  INFO 250193 --- [           main] org.apache.catalina.core.StandardEngine  : Starting Servlet engine: [Apache Tomcat/9.0.41]
2021-02-28 20:26:18.492  INFO 250193 --- [           main] o.a.c.c.C.[Tomcat].[localhost].[/]       : Initializing Spring embedded WebApplicationContext
2021-02-28 20:26:18.492  INFO 250193 --- [           main] w.s.c.ServletWebServerApplicationContext : Root WebApplicationContext: initialization completed in 921 ms
2021-02-28 20:26:18.720  INFO 250193 --- [           main] o.s.s.concurrent.ThreadPoolTaskExecutor  : Initializing ExecutorService 'applicationTaskExecutor'
2021-02-28 20:26:18.884  INFO 250193 --- [           main] o.s.b.a.e.web.EndpointLinksResolver      : Exposing 2 endpoint(s) beneath base path '/actuator'
2021-02-28 20:26:18.913  INFO 250193 --- [           main] o.s.b.w.embedded.tomcat.TomcatWebServer  : Tomcat started on port(s): 8080 (http) with context path ''
2021-02-28 20:26:18.931  INFO 250193 --- [           main] com.example.springboot.Application       : Started Application in 1.687 seconds (JVM running for 1.982)
Let's inspect the beans provided by Spring Boot:
application
applicationAvailability
applicationTaskExecutor
basicErrorController
beanNameHandlerMapping
beanNameViewResolver
characterEncodingFilter
classLoaderMetrics
commandLineRunner
controllerEndpointDiscoverer
controllerEndpointHandlerMapping
controllerExposeExcludePropertyEndpointFilter
conventionErrorViewResolver
defaultServletHandlerMapping
defaultViewResolver
diskSpaceHealthIndicator
dispatcherServlet
dispatcherServletMappingDescriptionProvider
dispatcherServletRegistration
endpointCachingOperationInvokerAdvisor
endpointMediaTypes
endpointOperationParameterMapper
envInfoContributor
error
errorAttributes
errorPageCustomizer
errorPageRegistrarBeanPostProcessor
fileDescriptorMetrics
filterMappingDescriptionProvider
flashMapManager
formContentFilter
handlerExceptionResolver
handlerFunctionAdapter
healthContributorRegistry
healthEndpoint
healthEndpointGroups
healthEndpointGroupsBeanPostProcessor
healthEndpointWebExtension
healthHttpCodeStatusMapper
healthStatusAggregator
helloController
httpRequestHandlerAdapter
infoEndpoint
jacksonObjectMapper
jacksonObjectMapperBuilder
jsonComponentModule
jvmGcMetrics
jvmMemoryMetrics
jvmThreadMetrics
lifecycleProcessor
localeCharsetMappingsCustomizer
localeResolver
logbackMetrics
management.endpoint.health-org.springframework.boot.actuate.autoconfigure.health.HealthEndpointProperties
management.endpoints.web-org.springframework.boot.actuate.autoconfigure.endpoint.web.WebEndpointProperties
management.endpoints.web.cors-org.springframework.boot.actuate.autoconfigure.endpoint.web.CorsEndpointProperties
management.health.diskspace-org.springframework.boot.actuate.autoconfigure.system.DiskSpaceHealthIndicatorProperties
management.info-org.springframework.boot.actuate.autoconfigure.info.InfoContributorProperties
management.metrics-org.springframework.boot.actuate.autoconfigure.metrics.MetricsProperties
management.metrics.export.simple-org.springframework.boot.actuate.autoconfigure.metrics.export.simple.SimpleProperties
management.server-org.springframework.boot.actuate.autoconfigure.web.server.ManagementServerProperties
managementServletContext
mappingJackson2HttpMessageConverter
messageConverters
meterRegistryPostProcessor
metricsHttpClientUriTagFilter
metricsHttpServerUriTagFilter
metricsRestTemplateCustomizer
metricsWebMvcConfigurer
micrometerClock
multipartConfigElement
multipartResolver
mvcContentNegotiationManager
mvcConversionService
mvcHandlerMappingIntrospector
mvcPathMatcher
mvcResourceUrlProvider
mvcUriComponentsContributor
mvcUrlPathHelper
mvcValidator
mvcViewResolver
org.springframework.aop.config.internalAutoProxyCreator
org.springframework.boot.actuate.autoconfigure.availability.AvailabilityHealthContributorAutoConfiguration
org.springframework.boot.actuate.autoconfigure.endpoint.EndpointAutoConfiguration
org.springframework.boot.actuate.autoconfigure.endpoint.web.ServletEndpointManagementContextConfiguration
org.springframework.boot.actuate.autoconfigure.endpoint.web.ServletEndpointManagementContextConfiguration$WebMvcServletEndpointManagementContextConfiguration
org.springframework.boot.actuate.autoconfigure.endpoint.web.WebEndpointAutoConfiguration
org.springframework.boot.actuate.autoconfigure.endpoint.web.WebEndpointAutoConfiguration$WebEndpointServletConfiguration
org.springframework.boot.actuate.autoconfigure.endpoint.web.servlet.WebMvcEndpointManagementContextConfiguration
org.springframework.boot.actuate.autoconfigure.health.HealthContributorAutoConfiguration
org.springframework.boot.actuate.autoconfigure.health.HealthEndpointAutoConfiguration
org.springframework.boot.actuate.autoconfigure.health.HealthEndpointConfiguration
org.springframework.boot.actuate.autoconfigure.health.HealthEndpointWebExtensionConfiguration
org.springframework.boot.actuate.autoconfigure.info.InfoContributorAutoConfiguration
org.springframework.boot.actuate.autoconfigure.info.InfoEndpointAutoConfiguration
org.springframework.boot.actuate.autoconfigure.metrics.CompositeMeterRegistryAutoConfiguration
org.springframework.boot.actuate.autoconfigure.metrics.JvmMetricsAutoConfiguration
org.springframework.boot.actuate.autoconfigure.metrics.LogbackMetricsAutoConfiguration
org.springframework.boot.actuate.autoconfigure.metrics.MetricsAutoConfiguration
org.springframework.boot.actuate.autoconfigure.metrics.SystemMetricsAutoConfiguration
org.springframework.boot.actuate.autoconfigure.metrics.export.simple.SimpleMetricsExportAutoConfiguration
org.springframework.boot.actuate.autoconfigure.metrics.integration.IntegrationMetricsAutoConfiguration
org.springframework.boot.actuate.autoconfigure.metrics.web.client.HttpClientMetricsAutoConfiguration
org.springframework.boot.actuate.autoconfigure.metrics.web.client.RestTemplateMetricsConfiguration
org.springframework.boot.actuate.autoconfigure.metrics.web.servlet.WebMvcMetricsAutoConfiguration
org.springframework.boot.actuate.autoconfigure.metrics.web.tomcat.TomcatMetricsAutoConfiguration
org.springframework.boot.actuate.autoconfigure.system.DiskSpaceHealthContributorAutoConfiguration
org.springframework.boot.actuate.autoconfigure.web.mappings.MappingsEndpointAutoConfiguration
org.springframework.boot.actuate.autoconfigure.web.mappings.MappingsEndpointAutoConfiguration$ServletWebConfiguration
org.springframework.boot.actuate.autoconfigure.web.mappings.MappingsEndpointAutoConfiguration$ServletWebConfiguration$SpringMvcConfiguration
org.springframework.boot.actuate.autoconfigure.web.server.ManagementContextAutoConfiguration
org.springframework.boot.actuate.autoconfigure.web.server.ManagementContextAutoConfiguration$SameManagementContextConfiguration
org.springframework.boot.actuate.autoconfigure.web.server.ManagementContextAutoConfiguration$SameManagementContextConfiguration$EnableSameManagementContextConfiguration
org.springframework.boot.actuate.autoconfigure.web.servlet.ServletManagementContextAutoConfiguration
org.springframework.boot.autoconfigure.AutoConfigurationPackages
org.springframework.boot.autoconfigure.aop.AopAutoConfiguration
org.springframework.boot.autoconfigure.aop.AopAutoConfiguration$ClassProxyingConfiguration
org.springframework.boot.autoconfigure.availability.ApplicationAvailabilityAutoConfiguration
org.springframework.boot.autoconfigure.context.ConfigurationPropertiesAutoConfiguration
org.springframework.boot.autoconfigure.context.LifecycleAutoConfiguration
org.springframework.boot.autoconfigure.context.PropertyPlaceholderAutoConfiguration
org.springframework.boot.autoconfigure.http.HttpMessageConvertersAutoConfiguration
org.springframework.boot.autoconfigure.http.HttpMessageConvertersAutoConfiguration$StringHttpMessageConverterConfiguration
org.springframework.boot.autoconfigure.http.JacksonHttpMessageConvertersConfiguration
org.springframework.boot.autoconfigure.http.JacksonHttpMessageConvertersConfiguration$MappingJackson2HttpMessageConverterConfiguration
org.springframework.boot.autoconfigure.info.ProjectInfoAutoConfiguration
org.springframework.boot.autoconfigure.internalCachingMetadataReaderFactory
org.springframework.boot.autoconfigure.jackson.JacksonAutoConfiguration
org.springframework.boot.autoconfigure.jackson.JacksonAutoConfiguration$Jackson2ObjectMapperBuilderCustomizerConfiguration
org.springframework.boot.autoconfigure.jackson.JacksonAutoConfiguration$JacksonObjectMapperBuilderConfiguration
org.springframework.boot.autoconfigure.jackson.JacksonAutoConfiguration$JacksonObjectMapperConfiguration
org.springframework.boot.autoconfigure.jackson.JacksonAutoConfiguration$ParameterNamesModuleConfiguration
org.springframework.boot.autoconfigure.task.TaskExecutionAutoConfiguration
org.springframework.boot.autoconfigure.task.TaskSchedulingAutoConfiguration
org.springframework.boot.autoconfigure.web.client.RestTemplateAutoConfiguration
org.springframework.boot.autoconfigure.web.embedded.EmbeddedWebServerFactoryCustomizerAutoConfiguration
org.springframework.boot.autoconfigure.web.embedded.EmbeddedWebServerFactoryCustomizerAutoConfiguration$TomcatWebServerFactoryCustomizerConfiguration
org.springframework.boot.autoconfigure.web.servlet.DispatcherServletAutoConfiguration
org.springframework.boot.autoconfigure.web.servlet.DispatcherServletAutoConfiguration$DispatcherServletConfiguration
org.springframework.boot.autoconfigure.web.servlet.DispatcherServletAutoConfiguration$DispatcherServletRegistrationConfiguration
org.springframework.boot.autoconfigure.web.servlet.HttpEncodingAutoConfiguration
org.springframework.boot.autoconfigure.web.servlet.MultipartAutoConfiguration
org.springframework.boot.autoconfigure.web.servlet.ServletWebServerFactoryAutoConfiguration
org.springframework.boot.autoconfigure.web.servlet.ServletWebServerFactoryConfiguration$EmbeddedTomcat
org.springframework.boot.autoconfigure.web.servlet.WebMvcAutoConfiguration
org.springframework.boot.autoconfigure.web.servlet.WebMvcAutoConfiguration$EnableWebMvcConfiguration
org.springframework.boot.autoconfigure.web.servlet.WebMvcAutoConfiguration$WebMvcAutoConfigurationAdapter
org.springframework.boot.autoconfigure.web.servlet.error.ErrorMvcAutoConfiguration
org.springframework.boot.autoconfigure.web.servlet.error.ErrorMvcAutoConfiguration$DefaultErrorViewResolverConfiguration
org.springframework.boot.autoconfigure.web.servlet.error.ErrorMvcAutoConfiguration$WhitelabelErrorViewConfiguration
org.springframework.boot.autoconfigure.websocket.servlet.WebSocketServletAutoConfiguration
org.springframework.boot.autoconfigure.websocket.servlet.WebSocketServletAutoConfiguration$TomcatWebSocketConfiguration
org.springframework.boot.context.internalConfigurationPropertiesBinder
org.springframework.boot.context.internalConfigurationPropertiesBinderFactory
org.springframework.boot.context.properties.BoundConfigurationProperties
org.springframework.boot.context.properties.ConfigurationPropertiesBindingPostProcessor
org.springframework.boot.context.properties.EnableConfigurationPropertiesRegistrar.methodValidationExcludeFilter
org.springframework.context.annotation.internalAutowiredAnnotationProcessor
org.springframework.context.annotation.internalCommonAnnotationProcessor
org.springframework.context.annotation.internalConfigurationAnnotationProcessor
org.springframework.context.event.internalEventListenerFactory
org.springframework.context.event.internalEventListenerProcessor
parameterNamesModule
pathMappedEndpoints
pingHealthContributor
preserveErrorControllerTargetClassPostProcessor
processorMetrics
propertiesMeterFilter
propertySourcesPlaceholderConfigurer
requestContextFilter
requestMappingHandlerAdapter
requestMappingHandlerMapping
resourceHandlerMapping
restTemplateBuilder
restTemplateBuilderConfigurer
restTemplateExchangeTagsProvider
routerFunctionMapping
server-org.springframework.boot.autoconfigure.web.ServerProperties
servletEndpointDiscoverer
servletEndpointRegistrar
servletExposeExcludePropertyEndpointFilter
servletMappingDescriptionProvider
servletWebChildContextFactory
servletWebServerFactoryCustomizer
simpleConfig
simpleControllerHandlerAdapter
simpleMeterRegistry
spring.info-org.springframework.boot.autoconfigure.info.ProjectInfoProperties
spring.jackson-org.springframework.boot.autoconfigure.jackson.JacksonProperties
spring.lifecycle-org.springframework.boot.autoconfigure.context.LifecycleProperties
spring.mvc-org.springframework.boot.autoconfigure.web.servlet.WebMvcProperties
spring.resources-org.springframework.boot.autoconfigure.web.ResourceProperties
spring.servlet.multipart-org.springframework.boot.autoconfigure.web.servlet.MultipartProperties
spring.task.execution-org.springframework.boot.autoconfigure.task.TaskExecutionProperties
spring.task.scheduling-org.springframework.boot.autoconfigure.task.TaskSchedulingProperties
spring.web-org.springframework.boot.autoconfigure.web.WebProperties
standardJacksonObjectMapperBuilderCustomizer
stringHttpMessageConverter
taskExecutorBuilder
taskSchedulerBuilder
themeResolver
tomcatMetricsBinder
tomcatServletWebServerFactory
tomcatServletWebServerFactoryCustomizer
tomcatWebServerFactoryCustomizer
uptimeMetrics
viewControllerHandlerMapping
viewNameTranslator
viewResolver
webEndpointDiscoverer
webEndpointPathMapper
webEndpointServletHandlerMapping
webExposeExcludePropertyEndpointFilter
webMvcMetricsFilter
webMvcTagsProvider
webServerFactoryCustomizerBeanPostProcessor
websocketServletWebServerCustomizer
welcomePageHandlerMapping
^C2021-02-28 20:26:21.995  INFO 250193 --- [extShutdownHook] o.s.s.concurrent.ThreadPoolTaskExecutor  : Shutting down ExecutorService 'applicationTaskExecutor'
zaphod:complete$
```

3. Validate that this works correctly by using your browser to go to http://localhost:8080/ . This should print "Greetings from Spring Boot!".
4. Perform an S2I build by using the new-app command and using the "java:11" imagestream. This imagestream is a builder image for Java code -
particularly, code that will be built using maven. Specify the name of the app as "sample-boot-app". Note that:
    1.  You should use the "--as-deployment-config" flag on the new-app command.
    2.  You should also specify the "--context-dir" flag, with the "complete" sub-directory specified as its value
```
zaphod:complete$ oc new-app --name=sample-boot-app java:11~https://github.com/kstephen314159/s2i-builds.git --as-deployment-config --context-dir=complete
--> Found image 5232a63 (5 weeks old) in image stream "openshift/java" under tag "11" for "java:11"

    Java Applications 
    ----------------- 
    Platform for building and running plain Java applications (fat-jar and flat classpath)

    Tags: builder, java

    * A source build using source code from https://github.com/kstephen314159/s2i-builds.git will be created
      * The resulting image will be pushed to image stream tag "sample-boot-app:latest"
      * Use 'oc start-build' to trigger a new build
    * This image will be deployed in deployment config "sample-boot-app"
    * Ports 8080/tcp, 8443/tcp, 8778/tcp will be load balanced by service "sample-boot-app"
      * Other containers can access this service through the hostname "sample-boot-app"

--> Creating resources ...
    imagestream.image.openshift.io "sample-boot-app" created
    buildconfig.build.openshift.io "sample-boot-app" created
    deploymentconfig.apps.openshift.io "sample-boot-app" created
    service "sample-boot-app" created
--> Success
    Build scheduled, use 'oc logs -f buildconfig/sample-boot-app' to track its progress.
    Application is not exposed. You can expose services to the outside world by executing one or more of the commands below:
     'oc expose service/sample-boot-app' 
    Run 'oc status' to view your app.
zaphod:complete$
```

5. Observe the build by using the "oc logs" command to look at the buildconfig for "sample-boot-app".
```
zaphod:complete$ oc logs -f bc/sample-boot-app
Cloning "https://github.com/kstephen314159/s2i-builds.git" ...
	Commit:	1509218662473e275b50ba66022b767eced6f397 (updated README.md with exercise instructions)
	Author:	Kenneth Stephen <kstephe@us.ibm.com>
	Date:	Sun Feb 28 19:02:39 2021 -0500
Caching blobs under "/var/cache/blobs".
Getting image source signatures
Copying blob sha256:a6babf54cb34226edceaeb593bf791a5c8c4de01399756ac710b438a282bb249
Copying blob sha256:8ef598dbb46127ae7fd03bd1004f2e64e451a84213a72165166cbfb5e6f515b8
Copying blob sha256:bade03519b0d36b16221d683ad4b69fe6e3ab13bce6558c4a33e4c844680d700
Copying config sha256:5232a63e55ce640182b9735473ae6efa4b1384466917eff935424c4c1fd1afce
Writing manifest to image destination
Storing signatures
Generating dockerfile with builder image image-registry.openshift-image-registry.svc:5000/openshift/java@sha256:c343983d08baf2b3cc19483734808b07523a0860a5b17fdcb32de2d1b85306ca
STEP 1: FROM image-registry.openshift-image-registry.svc:5000/openshift/java@sha256:c343983d08baf2b3cc19483734808b07523a0860a5b17fdcb32de2d1b85306ca
.
.
.
```

6. After the build is done running, use the "oc get pods" command to observe the status of the application. Initially, you will see a deploy
pod instantiated. After it is done running, the pod for the actual application will be instantiated.
```
zaphod:complete$ oc get pods
NAME                               READY   STATUS      RESTARTS   AGE
.
.
.
sample-boot-app-1-build            0/1     Completed   0          3m6s
sample-boot-app-1-dbm7v            1/1     Running     0          103s
sample-boot-app-1-deploy           0/1     Completed   0          109s
.
.
zaphod:complete$
```

7. Observe the logs of the application as it starts up, using the "oc logs" command.
```
zaphod:complete$ oc logs -f sample-boot-app-1-dbm7v
Starting the Java application using /opt/jboss/container/java/run/run-java.sh ...
INFO exec  java -javaagent:/usr/share/java/jolokia-jvm-agent/jolokia-jvm.jar=config=/opt/jboss/container/jolokia/etc/jolokia.properties -XX:+UseParallelOldGC -XX:MinHeapFreeRatio=10 -XX:MaxHeapFreeRatio=20 -XX:GCTimeRatio=4 -XX:AdaptiveSizePolicyWeight=90 -XX:MaxMetaspaceSize=100m -XX:+ExitOnOutOfMemoryError -cp "." -jar /deployments/spring-boot-0.0.1-SNAPSHOT.jar  
WARNING: An illegal reflective access operation has occurred
WARNING: Illegal reflective access by org.jolokia.util.ClassUtil (file:/usr/share/java/jolokia-jvm-agent/jolokia-jvm.jar) to constructor sun.security.x509.X500Name(java.lang.String,java.lang.String,java.lang.String,java.lang.String,java.lang.String,java.lang.String)
WARNING: Please consider reporting this to the maintainers of org.jolokia.util.ClassUtil
WARNING: Use --illegal-access=warn to enable warnings of further illegal reflective access operations
WARNING: All illegal access operations will be denied in a future release
I> No access restrictor found, access to any MBean is allowed
Jolokia: Agent started with URL https://172.30.95.240:8778/jolokia/

  .   ____          _            __ _ _
 /\\ / ___'_ __ _ _(_)_ __  __ _ \ \ \ \
( ( )\___ | '_ | '_| | '_ \/ _` | \ \ \ \
 \\/  ___)| |_)| | | | | || (_| |  ) ) ) )
  '  |____| .__|_| |_|_| |_\__, | / / / /
 =========|_|==============|___/=/_/_/_/
 :: Spring Boot ::                (v2.4.2)

2021-03-01 01:30:09.027  INFO 1 --- [           main] com.example.springboot.Application       : Starting Application v0.0.1-SNAPSHOT using Java 11.0.10 on sample-boot-app-1-dbm7v with PID 1 (/deployments/spring-boot-0.0.1-SNAPSHOT.jar started by jboss in /deployments)
.
.
.
```

8. Create a route for the application by using the "oc create route edge" command. This will produce an https endpoint that you can access via
the browser. Check to see that you get a message at the root URI saying "Greetings from Spring Boot!".
```
zaphod:complete$ oc create route edge --service=sample-boot-app
route.route.openshift.io/sample-boot-app created
zaphod:complete$ oc get route sample-boot-app
NAME              HOST/PORT                                                                                                                   PATH   SERVICES          PORT       TERMINATION   WILDCARD
sample-boot-app   sample-boot-app-kstephe-us.ose-bootcamp-1612539632-f72ef11f3ab089a8c677044eb28292cd-0000.sjc03.containers.appdomain.cloud          sample-boot-app   8080-tcp   edge          None
zaphod:complete$ curl -k https://sample-boot-app-kstephe-us.ose-bootcamp-1612539632-f72ef11f3ab089a8c677044eb28292cd-0000.sjc03.containers.appdomain.cloud
Greetings from Spring Boot!zaphod:complete$
```
